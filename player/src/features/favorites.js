// Favourites feature (T-201). Owns the red-key route entirely in this module —
// app/remote.js needs no edit, which is what proves T-173. Pure decisions live
// in lib/favorites.js; this slice owns persistence and the current-channel read.

import { getSettings, saveSettings } from '../config.js';
import { state } from '../app/state.js';
import { isEnabled, bindRoute } from '../app/plugins.js';
import { FAVORITES_GROUP, isFavorite, toggleFavorite, favoritesGroup, filterFavorites } from '../lib/favorites.js';

export { FAVORITES_GROUP, isFavorite, favoritesGroup, filterFavorites };

// URL of the channel the user is on now — the stable identity used by resume.
export function currentChannelUrl() {
  const channel = state.channels && state.channels[state.currentIndex];
  return channel && typeof channel.url === 'string' ? channel.url : '';
}

// Toggle and persist. Returns true when the channel is now a favourite.
export function toggleCurrentFavorite() {
  const url = currentChannelUrl();
  if (!url) return false;
  const next = toggleFavorite(getSettings().favorites, url);
  saveSettings({ favorites: next });
  return isFavorite(next, url);
}

export const contract = {
  id: 'favorites',
  owns: ['red'],
  group: FAVORITES_GROUP,
};

// Self-register at boot when enabled. Disabling the feature removes its key:
// no route is bound, so red falls through to the reserved no-op handler.
if (isEnabled('favorites')) {
  bindRoute('favorites', 'red', toggleCurrentFavorite);
}

export default contract;
