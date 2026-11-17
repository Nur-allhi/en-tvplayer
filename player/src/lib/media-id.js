// Stable media identifiers (T-180). A media id is a hash of the *normalized*
// stream URL, never a manifest index — so re-fetching a manifest with fresh
// auth tokens, or reordering its entries, keeps every id identical. Resume
// positions and favourites stay attached to the right media.

const PREFIX = 'm_';

export function normalizeMediaUrl(url) {
  if (typeof url !== 'string') return '';
  // Drop volatile query/fragment (tokens change per fetch) and lowercase the
  // scheme and host. Paths stay case-sensitive: servers may distinguish them.
  let key = url.trim().replace(/[?#].*$/, '');
  key = key.replace(/^([a-z]+:\/\/)([^/]+)/i, (_m, scheme, host) => scheme.toLowerCase() + host.toLowerCase());
  return key.replace(/\/+$/, '');
}

// FNV-1a 32-bit: short, deterministic, dependency-free and ample for a personal
// library. Hex output is URL- and JSON-safe.
export function mediaId(url) {
  const key = normalizeMediaUrl(url);
  if (!key) return '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return PREFIX + ('00000000' + hash.toString(16)).slice(-8);
}

export function episodeId(seriesId, season, number) {
  return seriesId + '_s' + String(season) + 'e' + String(number);
}
