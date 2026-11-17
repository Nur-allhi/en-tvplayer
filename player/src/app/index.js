// App hub (T-152). Imports every slice for its self-registration side effect,
// wires the few helpers the hub still owns, applies responsive TV scaling and
// starts the app. main.js is now a thin entry; nothing imports it.
import * as ui from '../ui/index.js';
import * as settings from '../settings/index.js';
import { showBootSplash, hideBootSplash } from './boot.js';
import { deps } from './deps.js';
import { applyFeatureFlags } from './plugins.js';
import { refreshProxyMenu } from '../features/proxy.js';
import { hydrateVod, startVodPersistence } from './vod-store.js';

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
  hydrateVod();
  startVodPersistence();
  deps.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
