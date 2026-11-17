// Add media by URL, M3U playlist or JSON manifest (T-181). The parsing is pure
// in lib/media-source.js; this slice owns the fetch, the settings form and the
// plain-English status text shown to the user.

import { fetchWithTimeout } from '../utils.js';
import { detectSourceKind, parseMediaManifest } from '../lib/media-source.js';
import { addMedia } from '../state/vod.js';

export async function importMediaSource(rawUrl) {
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  const kind = detectSourceKind(url);
  if (kind === 'unknown') {
    throw new Error('Enter a web link to a movie, an M3U playlist or a JSON library.');
  }

  // A direct URL is the entry itself — no fetch needed. Playlists and JSON
  // manifests are fetched with the same timeout helper playlist loading uses.
  const content = kind === 'direct' ? url : await fetchText(url);
  const entries = parseMediaManifest(content, kind);

  let added = 0;
  for (const raw of entries) {
    if (addMedia(raw)) added += 1;
  }
  if (added === 0) throw new Error('That source had no playable movies in it.');
  return added;
}

async function fetchText(url) {
  let response;
  try {
    response = await fetchWithTimeout(url, 10000);
  } catch {
    throw new Error('Could not reach that link. Check the address and your internet connection.');
  }
  if (!response.ok) throw new Error('That link could not be loaded. Please check the address.');
  return response.text();
}

export function renderVodAddCard() {
  let html = '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">🎬</span> Add movie or series</h3></div>';
  html += '<div class="card-body">';
  html += '<p class="hint">Paste a direct video link, an M3U playlist or a JSON library link.</p>';
  html += '<div class="input-group"><label>Source URL</label>';
  html += '<input id="vod-add-url" type="text" placeholder="https://…/movie.mp4"></div>';
  html += '<div class="select-grid"><button id="vod-add-btn" class="btn" type="button">Add source</button></div>';
  html += '<div id="vod-add-status" class="form-status" aria-live="polite"></div>';
  html += '</div></div>';
  return html;
}

export function setVodAddStatus(message, isError) {
  const el = document.getElementById('vod-add-status');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('is-error', !!isError);
  el.classList.toggle('is-success', !isError && !!message);
}

export async function saveAddMedia() {
  const field = document.getElementById('vod-add-url');
  const url = field ? field.value : '';
  setVodAddStatus('Loading source…', false);
  try {
    const count = await importMediaSource(url);
    setVodAddStatus('Added ' + count + (count === 1 ? ' movie.' : ' movies.'), false);
    return count;
  } catch (e) {
    setVodAddStatus(e && e.message ? e.message : 'That source could not be added.', true);
    return 0;
  }
}
