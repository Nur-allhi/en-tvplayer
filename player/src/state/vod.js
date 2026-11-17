// VOD library model (T-180). Pure transforms over vodState — no DOM, no
// storage. Persistence lives in app/vod-store.js. Ids come from media-id.js so
// they survive reorders and re-fetches of the same source.

import { mediaId, episodeId } from '../lib/media-id.js';
import { vodState } from './index.js';

/** Normalise one raw entry into a MediaEntry. @returns {Object|null} */
export function normalizeMediaEntry(entry) {
  if (!entry || typeof entry.url !== 'string') return null;
  const id = entry.id || mediaId(entry.url);
  if (!id) return null;
  const type = entry.type === 'series' ? 'series' : 'movie';
  const out = { id, title: entry.title || id, url: entry.url, type };
  if (entry.year) out.year = entry.year;
  if (Array.isArray(entry.genres)) out.genres = entry.genres.slice();
  if (typeof entry.duration === 'number') out.duration = entry.duration;
  if (typeof entry.resumeAt === 'number') out.resumeAt = entry.resumeAt;
  if (type === 'series') out.episodes = normalizeEpisodes(entry.episodes, id);
  return out;
}

export function normalizeEpisodes(episodes, entryId) {
  if (!Array.isArray(episodes)) return [];
  return episodes
    .map((ep) => {
      if (!ep || typeof ep.url !== 'string') return null;
      const episode = {
        id: ep.id || episodeId(entryId, ep.season || 0, ep.number || 0),
        title: ep.title || 'Episode ' + ep.number,
        url: ep.url,
        season: ep.season || 0,
        number: ep.number || 0,
      };
      if (Number.isFinite(ep.resumeAt)) episode.resumeAt = ep.resumeAt;
      return episode;
    })
    .filter(Boolean);
}

export function library() {
  return vodState.get().library;
}

export function findMedia(id) {
  return library().find((entry) => entry.id === id) || null;
}

/** Add or replace entries by id, keeping list order. */
export function addMedia(entries) {
  const incoming = (Array.isArray(entries) ? entries : [entries]).map(normalizeMediaEntry).filter(Boolean);
  const merged = library().slice();
  for (const entry of incoming) {
    const at = merged.findIndex((item) => item.id === entry.id);
    if (at === -1) merged.push(entry);
    else merged[at] = entry;
  }
  vodState.set({ library: merged });
  return merged.length;
}

/** Re-fetch: update known entries by id, preserving their resumeAt. */
export function mergeMedia(entries) {
  const incoming = (Array.isArray(entries) ? entries : [entries]).map(normalizeMediaEntry).filter(Boolean);
  const merged = library().slice();
  for (const entry of incoming) {
    const at = merged.findIndex((item) => item.id === entry.id);
    if (at === -1) merged.push(entry);
    else {
      // Positions are user data. A re-fetch must not discard them even when
      // the source omits the field, so merge by episode id.
      const savedEpisodes = new Map((merged[at].episodes || []).map((ep) => [ep.id, ep.resumeAt]));
      const episodes = (entry.episodes || []).map((ep) =>
        Number.isFinite(savedEpisodes.get(ep.id)) ? { ...ep, resumeAt: savedEpisodes.get(ep.id) } : ep,
      );
      merged[at] = { ...entry, episodes, resumeAt: merged[at].resumeAt ?? entry.resumeAt };
    }
  }
  vodState.set({ library: merged });
  return merged.length;
}

export function removeMedia(id) {
  const before = library().length;
  vodState.set({ library: library().filter((entry) => entry.id !== id) });
  return before - library().length;
}

/** Move one entry to another index without changing its id. */
export function reorderMedia(from, to) {
  const list = library().slice();
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return false;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  vodState.set({ library: list });
  return true;
}

export function clearMedia() {
  vodState.set({ library: [] });
}

export function setVodSearch(query) {
  vodState.set({ search: typeof query === 'string' ? query : '' });
}

/** Save a resume position on an entry (episodeId null) or one of its episodes. */
export function setResumeAt(id, episodeId, seconds) {
  const list = library().slice();
  const at = list.findIndex((entry) => entry.id === id);
  if (at === -1) return false;
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  if (!episodeId) {
    list[at] = { ...list[at], resumeAt: value };
  } else {
    const episodes = (list[at].episodes || []).map((ep) => (ep.id === episodeId ? { ...ep, resumeAt: value } : ep));
    if (!episodes.some((ep) => ep.id === episodeId && ep.resumeAt === value)) return false;
    list[at] = { ...list[at], episodes };
  }
  vodState.set({ library: list });
  return true;
}
