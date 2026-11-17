// Pure, stable media identifiers (T-180). An id is derived only from the
// normalised stream URL, so it survives a list reorder and a re-fetch of the
// same source. No DOM, no storage, no time.

/**
 * @typedef {Object} Episode
 * @property {string} id - stable `${entryId}-s${season}e${number}` slug
 * @property {string} title
 * @property {string} url - direct stream URL
 * @property {number} season
 * @property {number} number
 */

/**
 * @typedef {Object} MediaEntry
 * @property {string} id - stable slug (hash of the normalised URL)
 * @property {string} title
 * @property {string} url - direct stream URL
 * @property {'movie'|'series'} type
 * @property {number} [year]
 * @property {string[]} [genres]
 * @property {number} [duration] - seconds (movies)
 * @property {Episode[]} [episodes] - series only
 * @property {number} [resumeAt] - seconds
 */

/** Lowercase and trim a URL's scheme and host, drop the fragment and sort
 * query keys, so equivalent URLs hash identically. */
export function normalizeUrl(url) {
  if (typeof url !== 'string') return '';
  let value = url.trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    const sorted = [...parsed.searchParams.entries()]
      .map(([k, v]) => [k, v])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    parsed.search = '';
    for (const [k, v] of sorted) parsed.searchParams.append(k, v);
    value = parsed.toString();
  } catch {
    // A non-absolute URL is still hashable after whitespace cleanup.
  }
  return value.replace(/\/+$/, '');
}

// FNV-1a 32-bit — short, deterministic and dependency-free.
export function hashUrl(normalized) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** @returns {string} stable id for a stream URL, or '' for an empty URL */
export function mediaId(url) {
  const normalized = normalizeUrl(url);
  return normalized ? 'm-' + hashUrl(normalized) : '';
}

export function episodeId(entryId, season, number) {
  return entryId + '-s' + season + 'e' + number;
}
