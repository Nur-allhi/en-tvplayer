import { describe, it, expect } from 'vitest';
import { FAVORITES_GROUP, isFavorite, toggleFavorite, favoritesGroup, filterFavorites } from './favorites.js';

const CHANNELS = [
  { url: 'https://host/a.ts', name: 'A', group: 'News' },
  { url: 'https://host/b.ts', name: 'B', group: 'Sports' },
  { url: 'https://host/c.ts', name: 'C', group: 'News' },
];

describe('FAVORITES_GROUP', () => {
  it('has a stable, human-readable name', () => {
    expect(FAVORITES_GROUP).toBe('Favourites');
  });
});

describe('isFavorite', () => {
  it('finds a stored URL', () => {
    expect(isFavorite(['https://host/a.ts'], 'https://host/a.ts')).toBe(true);
  });

  it('is false for a missing URL or empty list', () => {
    expect(isFavorite([], 'https://host/a.ts')).toBe(false);
    expect(isFavorite(null, 'https://host/a.ts')).toBe(false);
    expect(isFavorite(['x'], '')).toBe(false);
  });
});

describe('toggleFavorite', () => {
  it('adds a URL that is not present', () => {
    expect(toggleFavorite([], 'https://host/a.ts')).toEqual(['https://host/a.ts']);
  });

  it('removes a URL that is present', () => {
    expect(toggleFavorite(['https://host/a.ts'], 'https://host/a.ts')).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = ['https://host/a.ts'];
    toggleFavorite(input, 'https://host/b.ts');
    expect(input).toEqual(['https://host/a.ts']);
  });

  it('handles a missing favourites list', () => {
    expect(toggleFavorite(null, 'https://host/a.ts')).toEqual(['https://host/a.ts']);
  });

  it('ignores an empty URL', () => {
    expect(toggleFavorite(['x'], '')).toEqual(['x']);
  });
});

describe('filterFavorites', () => {
  it('returns the channels whose URLs are favourited, in channel order', () => {
    const favorites = ['https://host/c.ts', 'https://host/a.ts'];
    expect(filterFavorites(CHANNELS, favorites).map((c) => c.name)).toEqual(['A', 'C']);
  });

  it('returns nothing for an empty favourites list', () => {
    expect(filterFavorites(CHANNELS, [])).toEqual([]);
  });

  it('ignores favourites that are not in the channel list', () => {
    expect(filterFavorites(CHANNELS, ['https://gone'])).toEqual([]);
  });
});

describe('favoritesGroup', () => {
  it('builds a pinned group with the favourite channels', () => {
    const group = favoritesGroup(CHANNELS, ['https://host/a.ts', 'https://host/c.ts']);
    expect(group).toMatchObject({ name: FAVORITES_GROUP, count: 2 });
    expect(group.channels.map((c) => c.name)).toEqual(['A', 'C']);
  });

  it('returns null when there are no favourites, so no empty group appears', () => {
    expect(favoritesGroup(CHANNELS, [])).toBeNull();
    expect(favoritesGroup(CHANNELS, ['https://gone'])).toBeNull();
  });
});
