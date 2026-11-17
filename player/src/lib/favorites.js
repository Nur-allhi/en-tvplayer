// Pure favourites logic (T-201). DOM-free: no storage, no DOM, no timers.
// Channel identity is the URL string, matching resume and the v4 schema.

export const FAVORITES_GROUP = 'Favourites';

export function isFavorite(favorites, url) {
  return !!url && Array.isArray(favorites) && favorites.includes(url);
}

// Returns a new array — never mutates the persisted one.
export function toggleFavorite(favorites, url) {
  if (!url) return Array.isArray(favorites) ? favorites.slice() : [];
  const list = Array.isArray(favorites) ? favorites.slice() : [];
  const at = list.indexOf(url);
  if (at >= 0) list.splice(at, 1);
  else list.push(url);
  return list;
}

export function filterFavorites(channels, favorites) {
  if (!Array.isArray(favorites) || favorites.length === 0) return [];
  return (channels || []).filter((ch) => ch && isFavorite(favorites, ch.url));
}

// A pinned, virtual group that sits at the top of the sidebar. Null when empty
// so no empty "Favourites" row is shown before the user marks anything.
export function favoritesGroup(channels, favorites) {
  const entries = filterFavorites(channels, favorites);
  if (entries.length === 0) return null;
  return { name: FAVORITES_GROUP, count: entries.length, channels: entries };
}
