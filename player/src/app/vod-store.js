// VOD persistence (T-180). The only module that couples the pure VOD model to
// en_settings.movies. Hydration is explicit; saves go through saveSettings so
// the v4 schema migration and unknown-key preservation still apply.

import { getSettings, saveSettings } from '../config.js';
import { vodState } from '../state/index.js';
import { normalizeMediaEntry, library } from '../state/vod.js';

let unsubscribe = null;
let saveTimer = null;

export function hydrateVod() {
  const movies = getSettings().movies || [];
  const entries = movies.map(normalizeMediaEntry).filter(Boolean);
  vodState.set({ library: entries, search: '' });
  return entries.length;
}

function persist() {
  saveSettings({ movies: library() });
}

// Debounced so a reorder or fast search burst writes once.
export function startVodPersistence(delay = 400) {
  stopVodPersistence();
  unsubscribe = vodState.subscribe(() => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, delay);
  });
  return unsubscribe;
}

export function stopVodPersistence() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  clearTimeout(saveTimer);
  saveTimer = null;
}

export function flushVod() {
  clearTimeout(saveTimer);
  persist();
}
