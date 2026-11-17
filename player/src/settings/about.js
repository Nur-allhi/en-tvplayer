// About panel and diagnostics action (T-200). The card was moved out of the
// 297-LOC render-cards.js so adding a button does not breach the 300-LOC cap.
import { APP_VERSION } from '../config.js';
import * as player from '../player/index.js';
import { getTvModel } from '../capabilities.js';
import { appLogRing } from '../lib/ring-buffer.js';
import { formatDiagnostics } from '../lib/diagnostics.js';
import { deps } from './deps.js';

export function renderAboutCard() {
  let html = '';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">\u2139</span> About</h3></div>';
  html += '<div class="card-body">';
  html +=
    '<p class="about-text">EN IPTV Player is built for modern IPTV sources, with first-class support for MPD streams and tokenized live channels that other Tizen players drop.</p>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">App</div></div><div class="toggle-value">EN IPTV Player</div></div>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">Version</div></div><div class="toggle-value">' +
    APP_VERSION +
    '</div></div>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">Engine</div></div><div class="toggle-value">Shaka Player</div></div>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">Native playback</div></div><div class="toggle-value">' +
    (player.isNativeAvailable() ? 'Available' : 'Not available') +
    '</div></div>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">Diagnostics</div></div><div class="toggle-value">' +
    '<button id="about-copy-diagnostics" class="btn" type="button">Copy diagnostics</button>' +
    '</div></div>';
  html += '</div></div>';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">\u{1F517}</span> Links</h3></div>';
  html += '<div class="card-body">';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">Developer</div></div><div class="toggle-value">Nur-allhi</div></div>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">GitHub</div></div><div class="toggle-value"><a class="about-link" href="https://github.com/Nur-allhi" target="_blank" rel="noopener">github.com/Nur-allhi</a></div></div>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">Telegram</div></div><div class="toggle-value"><a class="about-link" href="https://t.me/eniptvplayer" target="_blank" rel="noopener">t.me/eniptvplayer</a></div></div>';
  html += '</div></div>';
  return html;
}

export function diagnosticsText() {
  return formatDiagnostics({
    version: APP_VERSION,
    tvModel: getTvModel(),
    logTail: appLogRing.tail(),
  });
}

function confirmCopy() {
  const btn = typeof document !== 'undefined' ? document.getElementById('about-copy-diagnostics') : null;
  if (!btn) return;
  btn.textContent = 'Copied';
  setTimeout(() => {
    btn.textContent = 'Copy diagnostics';
  }, 1500);
}

function legacyCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {}
  document.body.removeChild(area);
  if (ok) confirmCopy();
}

export function copyDiagnostics() {
  const text = diagnosticsText();
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(confirmCopy, () => legacyCopy(text));
      return;
    }
    legacyCopy(text);
  } catch {
    legacyCopy(text);
  }
}

Object.assign(deps, { copyDiagnostics });
