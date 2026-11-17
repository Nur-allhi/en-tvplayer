import { fetchXtreamChannels } from './xtream.js';
import { parseM3u } from './lib/m3u.js';

export function fetchWithTimeout(url, ms) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out. Please check your internet connection.')), ms),
    ),
  ]);
}

export async function fetchPlaylist(url) {
  let resp;
  try {
    resp = await fetchWithTimeout(url, 10000);
  } catch {
    throw new Error('Could not load playlist. Please check the URL and your internet connection.');
  }
  if (!resp.ok) throw new Error('Server returned error ' + resp.status);
  const contentType = resp.headers.get('content-type') || '';
  const text = await resp.text();
  if (contentType.includes('json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.channels)) {
      return data.channels;
    }
    throw new Error('The playlist file has an unexpected format.');
  }
  if (text.includes('#EXTM3U')) {
    return parseM3u(text);
  }
  throw new Error('This playlist format is not supported. Please use an M3U or JSON playlist.');
}

// Playlist entry dispatcher: Xtream logins go through the Xtream API,
// everything else fetches a playlist URL as before.
export function fetchPlaylistEntry(entry) {
  if (entry && entry.type === 'xtream') {
    return fetchXtreamChannels(entry);
  }
  return fetchPlaylist(entry ? entry.url : '');
}

// Boot resilience: a transient blip shouldn't strand boot on a dead-end
// screen. Up to `retries` backoff re-fetches (1.5s, 3s) around the entry
// fetch; throws the last error when all attempts fail.
export async function fetchPlaylistWithRetry(entry, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    try {
      return await fetchPlaylistEntry(entry);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
