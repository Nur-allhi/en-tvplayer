import { getSettings } from './config.js';
import * as ui from './ui/index.js';
import * as settings from './settings/index.js';
// Boot stays module-level here; the app slices self-register into deps.
import { showBootSplash, hideBootSplash } from './app/boot.js';
import { deps } from './app/deps.js';
// Side-effect imports: each slice self-registers its functions into deps.
import './app/onboarding.js';
import './app/whats-new.js';
import './app/start.js';
import './app/shell.js';
import './app/tune.js';
import './app/channels.js';
import './app/remote.js';

// Preserve the old main.js public surface while the hub is still here.
export { refreshChannels } from './app/channels.js';

// The hub still owns these implementations until T-151/T-152 move them.
// Slices call back through these slots; wiring here (rather than importing
// main.js) is what keeps the app graph acyclic.
Object.assign(deps, {
  showBootSplash,
  hideBootSplash,
  showPlayer,
  showSettingsPage,
  refreshProxyMenu,
});

/* Responsive TV scaling: detect screen size and set CSS variable */
function applyResponsiveScale() {
  const sw = screen.width || 1920;
  const sh = screen.height || 1080;
  const scale = Math.max(sw / 1920, sh / 1080, 1.35);
  document.documentElement.style.setProperty('--tv-scale', scale);
}
applyResponsiveScale();

// Desktop test relay sidebar entry: hidden unless on a local test host with
// Settings → Playback → Proxy menu enabled. Called on boot and every time
// Settings closes (settings.hide() never fires the onClose callback).
function refreshProxyMenu() {
  const host = (typeof window !== 'undefined' && window.location.hostname) || '';
  const isLocalhost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(host);
  const show = isLocalhost && getSettings().showProxyMenu === true;
  const btn = document.getElementById('proxy-toggle-btn');
  if (btn) btn.classList.toggle('hidden', !show);
  const label = document.getElementById('proxy-testing-label');
  if (label) label.classList.toggle('hidden', !show);
}

// playlist refresh and re-sort); a raw index would rot on every fetch.

function showPlayer() {
  document.body.style.overflow = '';
  const playerContainer = document.getElementById('player-container');
  const nowPlaying = document.getElementById('now-playing');
  if (playerContainer) playerContainer.classList.remove('hidden');
  if (nowPlaying) nowPlaying.classList.remove('hidden');
  const videoEl = document.getElementById('video');
  if (videoEl) videoEl.style.visibility = '';
  ui.showSidebarWithContent();
}

function showSettingsPage() {
  const playerContainer = document.getElementById('player-container');
  const nowPlaying = document.getElementById('now-playing');
  if (playerContainer) playerContainer.classList.add('hidden');
  if (nowPlaying) nowPlaying.classList.add('hidden');
  if (ui.isFullscreenMode()) {
    ui.exitFullscreenMode();
  }
  ui.closeAllOverlays();
  ui.stopCursorAutoHide();
  ui.stopInactivityTimer();
  document.body.style.overflow = 'hidden';
  settings.show();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => deps.init());
} else {
  deps.init();
}
