import { describe, it, expect, beforeEach } from 'vitest';
import { getSettings, migrateSettings, SCHEMA_VERSION } from './config.js';

// T-186: config.js reads localStorage directly. Vitest runs in node with no
// DOM, so a tiny in-memory stand-in is enough to pin the exact upgrade path
// from a real v3-shaped `en_settings` value.

const KEY = 'en_settings';
const store = new Map();

beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
});

const seed = (obj) => store.set(KEY, JSON.stringify(obj));

describe('migrateSettings — additive v3 → v4', () => {
  it('defaults the new keys on a v3 shape and keeps every old key', () => {
    const v3 = {
      playlistUrl: 'https://example.com/list.m3u8',
      channels: [{ url: 'https://example.com/a.ts', name: 'A' }],
      hiddenGroups: ['News'],
      lastChannelUrl: 'https://example.com/a.ts',
      updateCheck: true,
      customFutureKey: 'keep-me',
    };
    const { settings, changed } = migrateSettings({ ...v3 });
    expect(changed).toBe(true);
    expect(settings.schemaVersion).toBe(SCHEMA_VERSION);
    expect(settings.movies).toEqual([]);
    expect(settings.favorites).toEqual([]);
    expect(settings.features).toEqual({ favorites: true, infoBar: true, vod: true });
    expect(settings.channels).toEqual(v3.channels);
    expect(settings.hiddenGroups).toEqual(['News']);
    expect(settings.lastChannelUrl).toBe(v3.lastChannelUrl);
    expect(settings.updateCheck).toBe(true);
    expect(settings.customFutureKey).toBe('keep-me');
    expect(settings.playlistUrl).toBe(v3.playlistUrl);
  });

  it('never overwrites an existing v4 value', () => {
    const s = {
      schemaVersion: 3,
      movies: [{ id: 'm1' }],
      favorites: ['https://example.com/a.ts'],
      features: { favorites: false },
    };
    const { settings } = migrateSettings(s);
    expect(settings.movies).toEqual([{ id: 'm1' }]);
    expect(settings.favorites).toEqual(['https://example.com/a.ts']);
    expect(settings.features).toEqual({ favorites: false, infoBar: true, vod: true });
  });

  it('is idempotent — a second pass changes nothing', () => {
    const first = migrateSettings({ channels: [], updateCheck: false });
    expect(first.changed).toBe(true);
    const second = migrateSettings(first.settings);
    expect(second.changed).toBe(false);
    expect(second.settings).toEqual(first.settings);
  });

  it('leaves a current schema untouched', () => {
    const v4 = {
      schemaVersion: SCHEMA_VERSION,
      movies: [],
      favorites: [],
      features: { favorites: true, infoBar: true, vod: true },
      channels: [],
    };
    const result = migrateSettings({ ...v4 });
    expect(result.changed).toBe(false);
  });

  it('repairs a non-object features value without dropping other keys', () => {
    const { settings } = migrateSettings({ features: 'oops', channels: [{ name: 'A' }] });
    expect(settings.features).toEqual({ favorites: true, infoBar: true, vod: true });
    expect(settings.channels).toEqual([{ name: 'A' }]);
  });
});

describe('getSettings migration path', () => {
  it('upgrades a stored v3 shape in place under the same en_settings key', () => {
    seed({
      channels: [{ url: 'https://example.com/a.ts', name: 'A' }],
      showWatermark: false,
      hiddenGroups: ['Sports'],
      mysteryKey: 42,
    });
    const s = getSettings();
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.movies).toEqual([]);
    expect(s.favorites).toEqual([]);
    expect(s.features).toEqual({ favorites: true, infoBar: true, vod: true });
    expect(s.showWatermark).toBe(false);
    expect(s.hiddenGroups).toEqual(['Sports']);
    expect(s.mysteryKey).toBe(42);
    // The key name never changes, and the migrated value is persisted back.
    const written = JSON.parse(store.get(KEY));
    expect(written.schemaVersion).toBe(SCHEMA_VERSION);
    expect(written.mysteryKey).toBe(42);
  });

  it('does not rewrite storage on a second load', () => {
    seed({ channels: [] });
    getSettings();
    const afterFirst = store.get(KEY);
    getSettings();
    expect(store.get(KEY)).toBe(afterFirst);
  });

  it('gives a fresh profile the v4 defaults', () => {
    const s = getSettings();
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.movies).toEqual([]);
    expect(s.favorites).toEqual([]);
    expect(s.features).toEqual({ favorites: true, infoBar: true, vod: true });
  });

  it('keeps the legacy single-playlist migration working after v4', () => {
    seed({ playlistUrl: 'https://example.com/list.m3u8', schemaVersion: 3 });
    const s = getSettings();
    expect(s.playlists).toHaveLength(1);
    expect(s.playlists[0]).toMatchObject({ name: 'Playlist 1', url: 'https://example.com/list.m3u8' });
    expect(s.activePlaylistIndex).toBe(0);
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(store.get(KEY)).not.toContain('playlistUrl');
  });
});
