// VOD library state and persistence (T-180). Backed by the vodState store from
// T-170 and persisted under `en_settings.movies`, which the T-186 schema
// migration creates. MediaEntry / Episode shapes follow docs/v4.PLAN.md §8.1.

import { getSettings, saveSettings } from '../config.js';
import { vodState } from './index.js';
import { mediaId, episodeId } from '../lib/media-id.js';

// Normalize a user- or manifest-supplied entry into a canonical MediaEntry.
// A supplied id wins; otherwise it is derived from the URL so ids survive a
// re-fetch. Returns null for anything that cannot be played.
export function toMediaEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  if (!url) return null;

  const type = raw.type === 'series' ? 'series' : 'movie';
  const entry = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : mediaId(url),
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : url,
    url,
    type,
  };
  if (typeof raw.year === 'number') entry.year = raw.year;
  if (Array.isArray(raw.genres)) entry.genres = raw.genres.filter((g) => typeof g === 'string');
  if (typeof raw.duration === 'number') entry.duration = raw.duration;
  if (typeof raw.resumeAt === 'number') entry.resumeAt = raw.resumeAt;

  if (type === 'series' && Array.isArray(raw.episodes)) {
    entry.episodes = raw.episodes
      .filter((ep) => ep && typeof ep.url === 'string' && ep.url.trim())
      .map((ep) => ({
        id: typeof ep.id === 'string' && ep.id ? ep.id : episodeId(entry.id, ep.season, ep.number),
        title: typeof ep.title === 'string' ? ep.title : '',
        url: ep.url.trim(),
        season: typeof ep.season === 'number' ? ep.season : 1,
        number: typeof ep.number === 'number' ? ep.number : 1,
      }));
  }
  return entry;
}

export function loadLibrary() {
  const stored = getSettings().movies;
  const library = Array.isArray(stored) ? stored.map(toMediaEntry).filter(Boolean) : [];
  vodState.set({ library, search: '' });
  return library;
}

export function getLibrary() {
  return vodState.get().library;
}

export function persistLibrary() {
  saveSettings({ movies: getLibrary().slice() });
  return getLibrary();
}

export function addMedia(raw) {
  const entry = toMediaEntry(raw);
  if (!entry) return null;
  const library = getLibrary().slice();
  const index = library.findIndex((item) => item.id === entry.id);
  if (index >= 0) library[index] = { ...library[index], ...entry };
  else library.push(entry);
  vodState.set({ library });
  persistLibrary();
  return entry;
}

export function removeMedia(id) {
  const library = getLibrary();
  const next = library.filter((item) => item.id !== id);
  if (next.length === library.length) return false;
  vodState.set({ library: next });
  persistLibrary();
  return true;
}

export function findMedia(id) {
  return getLibrary().find((item) => item.id === id) || null;
}

export function setVodSearch(query) {
  vodState.set({ search: typeof query === 'string' ? query : '' });
}
