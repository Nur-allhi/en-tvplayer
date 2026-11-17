import { describe, it, expect, beforeEach } from 'vitest';

// config.js is imported at module load; stub localStorage before importing
// the feature so getSettings/saveSettings work in the node env.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { state } = await import('../app/state.js');
const { FEATURES, dispatchRoute } = await import('../app/plugins.js');
const { currentChannelUrl, toggleCurrentFavorite, contract } = await import('./favorites.js');

const CHANNELS = [
  { url: 'https://host/a.ts', name: 'A', group: 'News' },
  { url: 'https://host/b.ts', name: 'B', group: 'Sports' },
];

beforeEach(() => {
  store.clear();
  store.set('en_settings', JSON.stringify({ favorites: [], schemaVersion: 4 }));
  state.channels = CHANNELS.slice();
  state.currentIndex = 0;
});

describe('favorites feature contract', () => {
  it('owns the red key', () => {
    expect(contract.id).toBe('favorites');
    expect(contract.owns).toContain('red');
  });

  it('registers the red route so no remote.js edit is needed', () => {
    expect(FEATURES.favorites.routes.red).toBe(toggleCurrentFavorite);
    expect(FEATURES.favorites.keys).toContain('red');
  });
});

describe('currentChannelUrl', () => {
  it('reads the current channel URL from shared state', () => {
    expect(currentChannelUrl()).toBe('https://host/a.ts');
    state.currentIndex = 1;
    expect(currentChannelUrl()).toBe('https://host/b.ts');
  });

  it('is empty when no channel is selected', () => {
    state.currentIndex = -1;
    expect(currentChannelUrl()).toBe('');
  });
});

describe('toggleCurrentFavorite', () => {
  it('adds the current channel and persists it', () => {
    expect(toggleCurrentFavorite()).toBe(true);
    const saved = JSON.parse(store.get('en_settings'));
    expect(saved.favorites).toEqual(['https://host/a.ts']);
  });

  it('removes the channel on a second press', () => {
    toggleCurrentFavorite();
    expect(toggleCurrentFavorite()).toBe(false);
    expect(JSON.parse(store.get('en_settings')).favorites).toEqual([]);
  });

  it('does nothing when there is no current channel', () => {
    state.currentIndex = -1;
    expect(toggleCurrentFavorite()).toBe(false);
    expect(JSON.parse(store.get('en_settings')).favorites).toEqual([]);
  });
});

describe('red route dispatch', () => {
  it('is claimed by the feature and toggles the favourite', () => {
    expect(dispatchRoute('red')).toBe(true);
    expect(JSON.parse(store.get('en_settings')).favorites).toEqual(['https://host/a.ts']);
  });

  it('an unrelated action is not claimed', () => {
    expect(dispatchRoute('unused-action')).toBe(false);
  });
});
