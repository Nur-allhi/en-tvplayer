import { describe, it, expect, beforeEach } from 'vitest';
import {
  toMediaEntry,
  loadLibrary,
  getLibrary,
  addMedia,
  removeMedia,
  findMedia,
  setVodSearch,
  persistLibrary,
} from './vod.js';
import { vodState } from './index.js';
import { mediaId } from '../lib/media-id.js';

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
  vodState.set({ library: [], search: '' });
});

const stored = () => (store.has(KEY) ? JSON.parse(store.get(KEY)) : {});

describe('toMediaEntry', () => {
  it('derives a stable id and defaults the title from the URL', () => {
    const entry = toMediaEntry({ url: 'https://host/a.mp4' });
    expect(entry).toMatchObject({
      id: mediaId('https://host/a.mp4'),
      url: 'https://host/a.mp4',
      title: 'https://host/a.mp4',
      type: 'movie',
    });
  });

  it('keeps a supplied id, title and optional fields', () => {
    const entry = toMediaEntry({
      id: 'custom',
      title: 'Film',
      url: 'https://host/a.mp4',
      type: 'movie',
      year: 2024,
      genres: ['Drama'],
      duration: 3600,
      resumeAt: 120,
    });
    expect(entry).toMatchObject({
      id: 'custom',
      title: 'Film',
      year: 2024,
      genres: ['Drama'],
      duration: 3600,
      resumeAt: 120,
    });
  });

  it('normalizes series episodes with stable ids', () => {
    const entry = toMediaEntry({
      url: 'https://host/series.m3u8',
      type: 'series',
      episodes: [
        { title: 'Pilot', url: 'https://host/e1.mp4', season: 1, number: 1 },
        { title: 'Two', url: 'https://host/e2.mp4', season: 1, number: 2 },
      ],
    });
    expect(entry.type).toBe('series');
    expect(entry.episodes).toHaveLength(2);
    expect(entry.episodes[0].id).toMatch(/_s1e1$/);
    expect(entry.episodes[1].id).toMatch(/_s1e2$/);
    expect(entry.episodes[0].id).toBe(entry.episodes[0].id);
  });

  it('rejects an entry without a URL', () => {
    expect(toMediaEntry({ title: 'No URL' })).toBeNull();
    expect(toMediaEntry(null)).toBeNull();
    expect(toMediaEntry({ url: '   ' })).toBeNull();
  });

  it('does not attach episodes to a movie', () => {
    const entry = toMediaEntry({ url: 'https://host/a.mp4', episodes: [{ url: 'https://host/e.mp4' }] });
    expect(entry.episodes).toBeUndefined();
  });
});

describe('VOD library store and persistence', () => {
  it('loads and normalizes the library from en_settings.movies', () => {
    store.set(KEY, JSON.stringify({ movies: [{ url: 'https://host/a.mp4' }] }));
    const library = loadLibrary();
    expect(library).toHaveLength(1);
    expect(library[0].id).toBe(mediaId('https://host/a.mp4'));
    expect(getLibrary()).toBe(library);
  });

  it('returns an empty library when nothing is stored', () => {
    expect(loadLibrary()).toEqual([]);
    expect(getLibrary()).toEqual([]);
  });

  it('adds media and persists it under en_settings.movies', () => {
    const entry = addMedia({ url: 'https://host/a.mp4', title: 'A' });
    expect(entry.id).toBe(mediaId('https://host/a.mp4'));
    expect(getLibrary()).toHaveLength(1);
    expect(stored().movies).toHaveLength(1);
    expect(stored().movies[0].id).toBe(entry.id);
  });

  it('updates an existing entry instead of duplicating it', () => {
    addMedia({ url: 'https://host/a.mp4', resumeAt: 10 });
    addMedia({ url: 'https://host/a.mp4', resumeAt: 99 });
    expect(getLibrary()).toHaveLength(1);
    expect(getLibrary()[0].resumeAt).toBe(99);
  });

  it('keeps ids stable when entries are added in a different order', () => {
    addMedia({ url: 'https://host/a.mp4' });
    addMedia({ url: 'https://host/b.mp4' });
    const first = getLibrary().map((m) => m.id);
    store.clear();
    vodState.set({ library: [], search: '' });
    addMedia({ url: 'https://host/b.mp4' });
    addMedia({ url: 'https://host/a.mp4' });
    expect(new Set(getLibrary().map((m) => m.id))).toEqual(new Set(first));
  });

  it('keeps ids stable across a re-fetch of the same manifest', () => {
    const manifest = [{ url: 'https://host/a.mp4?token=one' }, { url: 'https://host/b.mp4' }];
    store.set(KEY, JSON.stringify({ movies: manifest }));
    const ids = loadLibrary().map((m) => m.id);
    store.set(
      KEY,
      JSON.stringify({ movies: [{ url: 'https://host/a.mp4?token=two' }, { url: 'https://host/b.mp4' }] }),
    );
    expect(loadLibrary().map((m) => m.id)).toEqual(ids);
  });

  it('removes media and persists the removal', () => {
    const entry = addMedia({ url: 'https://host/a.mp4' });
    expect(removeMedia(entry.id)).toBe(true);
    expect(getLibrary()).toHaveLength(0);
    expect(stored().movies).toHaveLength(0);
  });

  it('reports when there is nothing to remove', () => {
    expect(removeMedia('missing')).toBe(false);
  });

  it('finds an entry by id', () => {
    const entry = addMedia({ url: 'https://host/a.mp4', title: 'A' });
    expect(findMedia(entry.id)).toMatchObject({ title: 'A' });
    expect(findMedia('missing')).toBeNull();
  });

  it('stores the cross-item search string separately', () => {
    setVodSearch('film');
    expect(vodState.get().search).toBe('film');
    setVodSearch(null);
    expect(vodState.get().search).toBe('');
  });

  it('loadLibrary resets the search', () => {
    setVodSearch('film');
    loadLibrary();
    expect(vodState.get().search).toBe('');
  });

  it('persistLibrary writes the current library back', () => {
    addMedia({ url: 'https://host/a.mp4' });
    persistLibrary();
    expect(stored().movies).toHaveLength(1);
  });
});
