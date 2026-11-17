// App hub (T-152). Imports every slice for its self-registration side effect,
// wires the few helpers the hub still owns, applies responsive TV scaling and
// starts the app. main.js is now a thin entry; nothing imports it.
import { getSettings } from '../config.js';
import * as ui from '../ui/index.js';
import * as settings from '../settings/index.js';
import { showBootSplash, hideBootSplash } from './boot.js';
import { deps } from './deps.js';
import { applyFeatureFlags, isEnabled } from './plugins.js';

// Side-effect imports: each slice self-registers its functions into deps.
import './onboarding.js';
import './whats-new.js';
import './start.js';
import './shell.js';
import './tune.js';
import './channels.js';
import './remote.js';

// These five implementations still live in the hub; slices reach them through
// slots instead of importing the hub, which keeps the app graph acyclic.
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
  const btn = document.getElementById('proxy-toggle-btn');
  const label = document.getElementById('proxy-testing-label');
  // The registry owns visibility: disabling proxyTesting here hides both rows
  // without editing this file or the shell's click binding.
  if (!isEnabled('proxyTesting')) {
    if (btn) btn.classList.add('hidden');
    if (label) label.classList.add('hidden');
    return;
  }
  const host = (typeof window !== 'undefined' && window.location.hostname) || '';
  const isLocalhost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(host);
  const show = isLocalhost && getSettings().showProxyMenu === true;
  if (btn) btn.classList.toggle('hidden', !show);
  if (label) label.classList.toggle('hidden', !show);
}

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

function boot() {
  applyFeatureFlags();
  deps.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
