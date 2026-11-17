// Media source parsing (T-181). Pure and DOM-free: no fetch, no storage. The
// caller fetches the text and hands it here, so every parse path can be tested
// in node and a malformed manifest becomes a plain-English error, never a raw
// SyntaxError or a stack trace shown to the user.

import { parseM3u } from './m3u.js';

export function detectSourceKind(url) {
  if (typeof url !== 'string') return 'unknown';
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (/\.m3u8?$/.test(path)) return 'm3u';
  if (/\.json$/.test(path)) return 'json';
  if (/^https?:\/\//.test(url.trim())) return 'direct';
  return 'unknown';
}

export function m3uToMediaEntries(text) {
  return parseM3u(text)
    .filter((channel) => channel && channel.url)
    .map((channel) => {
      const entry = { title: channel.name || channel.url, url: channel.url };
      // Carry the parsed ClearKey / header data into the VOD model so the
      // playback adapter can reuse the existing player DRM path unchanged.
      if (channel.drm) entry.drm = channel.drm;
      if (channel.customHeaders) entry.customHeaders = channel.customHeaders;
      if (channel.userAgent) entry.userAgent = channel.userAgent;
      if (channel.authQuery) entry.authQuery = channel.authQuery;
      return entry;
    });
}

export function parseMediaManifest(text, kind) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('That link came back empty. Check the address and try again.');
  }

  if (kind === 'direct') {
    return [{ title: text.trim(), url: text.trim() }];
  }
  if (kind === 'm3u') {
    return m3uToMediaEntries(text);
  }
  if (kind === 'json') {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('That link is not a valid JSON library. Check the file and try again.');
    }
    const list = Array.isArray(data) ? data : data && Array.isArray(data.movies) ? data.movies : null;
    if (!list) {
      throw new Error('The JSON library must be a list of movies, or an object with a "movies" list.');
    }
    return list;
  }
  throw new Error('That link does not look like a movie URL, an M3U playlist or a JSON library.');
}
