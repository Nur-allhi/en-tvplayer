import { describe, it, expect, beforeEach } from 'vitest';
import { vodState } from './index.js';
import {
  normalizeMediaEntry,
  normalizeEpisodes,
  addMedia,
  mergeMedia,
  removeMedia,
  reorderMedia,
  clearMedia,
  findMedia,
  setVodSearch,
  library,
  setResumeAt,
} from './vod.js';

const movie = (url, title) => ({ url, title, type: 'movie' });

beforeEach(() => {
  clearMedia();
  setVodSearch('');
});

describe('normalise', () => {
  it('derives an id from the url when none is given', () => {
    const entry = normalizeMediaEntry(movie('https://a.example/1', 'One'));
    expect(entry.id).toMatch(/^m-[0-9a-f]{8}$/);
  });

  it('keeps a supplied id', () => {
    expect(normalizeMediaEntry({ ...movie('https://a.example/1', 'One'), id: 'custom' }).id).toBe('custom');
  });

  it('rejects an entry without a url', () => {
    expect(normalizeMediaEntry({ title: 'No URL' })).toBeNull();
  });

  it('copies genres instead of sharing the input array', () => {
    const genres = ['Action'];
    const entry = normalizeMediaEntry({ ...movie('https://a.example/1', 'One'), genres });
    expect(entry.genres).not.toBe(genres);
  });

  it('normalises series episodes with stable ids', () => {
    const entry = normalizeMediaEntry({
      url: 'https://a.example/show',
      title: 'Show',
      type: 'series',
      episodes: [{ url: 'https://a.example/e1', title: 'Pilot', season: 1, number: 1 }],
    });
    expect(entry.episodes[0].id).toBe(entry.id + '-s1e1');
  });

  it('ignores invalid episodes', () => {
    expect(normalizeEpisodes([{ title: 'no url' }, { url: 'https://a/e' }], 'm-x')).toHaveLength(1);
  });
});

describe('library storage', () => {
  it('adds entries to the store', () => {
    addMedia([movie('https://a.example/1', 'One'), movie('https://a.example/2', 'Two')]);
    expect(library()).toHaveLength(2);
  });

  it('does not duplicate an id on a second add', () => {
    const entry = movie('https://a.example/1', 'One');
    addMedia([entry]);
    addMedia([entry]);
    expect(library()).toHaveLength(1);
  });

  it('finds an entry by id', () => {
    addMedia(movie('https://a.example/1', 'One'));
    expect(findMedia(library()[0].id).title).toBe('One');
  });

  it('returns null for a missing id', () => {
    expect(findMedia('missing')).toBeNull();
  });

  it('removes an entry by id', () => {
    addMedia(movie('https://a.example/1', 'One'));
    expect(removeMedia(library()[0].id)).toBe(1);
    expect(library()).toHaveLength(0);
  });

  it('reports zero when removing an unknown id', () => {
    addMedia(movie('https://a.example/1', 'One'));
    expect(removeMedia('missing')).toBe(0);
  });

  it('clears the library', () => {
    addMedia(movie('https://a.example/1', 'One'));
    clearMedia();
    expect(library()).toEqual([]);
  });

  it('keeps ids stable across a reorder', () => {
    addMedia([movie('https://a.example/1', 'One'), movie('https://a.example/2', 'Two')]);
    const before = library().map((entry) => entry.id);
    expect(reorderMedia(0, 1)).toBe(true);
    expect(library().map((entry) => entry.id)).toEqual([before[1], before[0]]);
  });

  it('rejects an out-of-range reorder', () => {
    addMedia(movie('https://a.example/1', 'One'));
    expect(reorderMedia(0, 5)).toBe(false);
    expect(reorderMedia(-1, 0)).toBe(false);
  });

  it('keeps ids stable across a re-fetch', () => {
    addMedia(movie('https://a.example/1', 'One'));
    const id = library()[0].id;
    mergeMedia([movie('https://a.example/1', 'One remastered')]);
    expect(library()[0].id).toBe(id);
    expect(library()[0].title).toBe('One remastered');
  });

  it('preserves resumeAt across a re-fetch', () => {
    addMedia({ ...movie('https://a.example/1', 'One'), resumeAt: 42 });
    mergeMedia([movie('https://a.example/1', 'One')]);
    expect(library()[0].resumeAt).toBe(42);
  });

  it('adds new entries found during a re-fetch', () => {
    addMedia(movie('https://a.example/1', 'One'));
    mergeMedia([movie('https://a.example/2', 'Two')]);
    expect(library()).toHaveLength(2);
  });

  it('stores the search query', () => {
    setVodSearch('sea');
    expect(vodState.get().search).toBe('sea');
  });

  it('normalises a non-string query', () => {
    setVodSearch(null);
    expect(vodState.get().search).toBe('');
  });
});

describe('resume positions (T-183)', () => {
  const series = () => ({
    url: 'https://a.example/series',
    title: 'Series',
    type: 'series',
    episodes: [{ url: 'https://a.example/e1', title: 'One', season: 1, number: 1 }],
  });

  const add = (entry) => {
    addMedia(entry);
    return library()[library().length - 1].id;
  };

  it('preserves an episode resumeAt when normalising', () => {
    const id = add({ ...series(), episodes: [{ ...series().episodes[0], resumeAt: 42 }] });
    expect(findMedia(id).episodes[0].resumeAt).toBe(42);
  });

  it('keeps episode positions across a re-fetch', () => {
    const id = add(series());
    setResumeAt(id, null, 12);
    setResumeAt(id, findMedia(id).episodes[0].id, 75);
    mergeMedia({ ...series(), title: 'Renamed' });
    const entry = findMedia(id);
    expect(entry.title).toBe('Renamed');
    expect(entry.resumeAt).toBe(12);
    expect(entry.episodes[0].resumeAt).toBe(75);
  });

  it('sets an entry position when no episode id is given', () => {
    const id = add(movie('https://a.example/1', 'One'));
    expect(setResumeAt(id, null, 30)).toBe(true);
    expect(findMedia(id).resumeAt).toBe(30);
  });

  it('sets an episode position', () => {
    const id = add(series());
    const episodeId = findMedia(id).episodes[0].id;
    expect(setResumeAt(id, episodeId, 90)).toBe(true);
    expect(findMedia(id).episodes[0].resumeAt).toBe(90);
  });

  it('ignores an unknown media id', () => {
    expect(setResumeAt('missing', null, 30)).toBe(false);
  });

  it('ignores an unknown episode id', () => {
    const id = add(series());
    expect(setResumeAt(id, 'missing', 30)).toBe(false);
  });

  it('floors negative positions at zero', () => {
    const id = add(movie('https://a.example/1', 'One'));
    setResumeAt(id, null, -5);
    expect(findMedia(id).resumeAt).toBe(0);
  });
});
