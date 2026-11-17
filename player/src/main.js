import { getSettings } from './config.js';
import * as player from './player/index.js';
import * as ui from './ui/index.js';
import * as settings from './settings/index.js';
import { capabilities } from './capabilities.js';
import { hasTvKeyInput } from './lib/capabilities.js';
// Boot stays module-level here; the app slices self-register into deps.
import { showBootSplash, hideBootSplash } from './app/boot.js';
import { state } from './app/state.js';
import { deps } from './app/deps.js';
// Side-effect imports: each slice self-registers its functions into deps.
import './app/onboarding.js';
import './app/whats-new.js';
import './app/start.js';
import './app/shell.js';
import './app/tune.js';
import './app/channels.js';

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
  handleRemoteAction,
  registerTizenKeys,
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

// Readback forces style/layout (and with it, a composite) synchronously,
// so the tune veil is on screen before heavy teardown below.

function registerTizenKeys() {
  if (!hasTvKeyInput(capabilities())) return;
  const keys = [
    'ColorF0Red',
    'ColorF1Green',
    'ColorF2Yellow',
    'ColorF3Blue',
    'MediaPlayPause',
    'MediaPlay',
    'MediaPause',
    'MediaStop',
    'MediaFastForward',
    'MediaRewind',
    'MediaTrackNext',
    'MediaTrackPrevious',
    'ChannelUp',
    'ChannelDown',
  ];
  for (const key of keys) {
    try {
      window.tizen.tvinputdevice.registerKey(key);
    } catch {
      console.warn('Failed to register Tizen key:', key);
    }
  }
}

// CH Up/Down (and Prev/Next keys): retune to the adjacent channel in the
// current group view, wrapping around.
function zapChannel(step) {
  const displayChannels = deps.getDisplayChannels();
  if (displayChannels.length === 0) return;
  const currentDisplayIdx = displayChannels.indexOf(state.channels[state.currentIndex]);
  const idx = currentDisplayIdx >= 0 ? currentDisplayIdx : 0;
  const target = (idx + step + displayChannels.length) % displayChannels.length;
  state.currentIndex = state.channels.indexOf(displayChannels[target]);
  ui.selectChannel(state.currentIndex, true);
}

function handleRemoteAction(action, value) {
  if (action === 'back') {
    const now = Date.now();
    if (now - state.lastBackTime < 600) return;
    state.lastBackTime = now;
  }
  if (deps.isOnboardingOpen()) {
    switch (action) {
      case 'left':
      case 'right':
      case 'up':
      case 'down':
        state.onboardFocus = state.onboardFocus === 0 ? 1 : 0;
        deps.updateOnboardFocus();
        break;
      case 'select':
        deps.selectOnboarding();
        break;
      case 'back':
        deps.hideOnboarding();
        break;
      default:
        break;
    }
    return;
  }
  if (deps.isWhatsNewOpen()) {
    switch (action) {
      case 'select':
      case 'back':
        deps.closeWhatsNew();
        break;
    }
    return;
  }
  if (ui.isDialogOpen()) {
    switch (action) {
      case 'left':
      case 'right':
        ui.dialogNavigate(action === 'right' ? 1 : -1);
        break;
      case 'up':
      case 'down':
        ui.dialogNavigate(action === 'down' ? 1 : -1);
        break;
      case 'select':
        ui.dialogSelect();
        break;
      case 'back':
        ui.hideConfirmDialog();
        break;
      default:
        break;
    }
    return;
  }

  if (settings.isVisible()) {
    switch (action) {
      case 'up':
        settings.navigate(-1);
        break;
      case 'down':
        settings.navigate(1);
        break;
      case 'left':
        settings.navigateNav(-1);
        break;
      case 'right':
        settings.navigateNav(1);
        break;
      case 'select':
        settings.selectFocused();
        break;
      case 'back':
        settings.hide();
        refreshProxyMenu();
        ui.refreshGroupVisibility();
        state.selectedGroup = ui.getSelectedGroup();
        // BUG-018: with no playlist yet, initialize the empty shell so the
        // sidebars and Settings stay reachable.
        if (state.channels && state.channels.length > 0) {
          showPlayer();
        } else {
          deps.startPlayer();
        }
        ui.stopInactivityTimer();
        break;
    }
    return;
  }

  if (ui.isRightSidebarOpen()) {
    switch (action) {
      case 'up':
        ui.rightSidebarNavigateUp();
        break;
      case 'down':
        ui.rightSidebarNavigateDown();
        break;
      case 'select':
        ui.rightSidebarSelect();
        break;
      case 'back':
        ui.toggleRightSidebar();
        return;
      case 'left':
        ui.toggleRightSidebar();
        ui.toggleSidebar();
        break;
      case 'right':
        break;
      case 'channelUp':
        ui.toggleRightSidebar();
        zapChannel(1);
        break;
      case 'channelDown':
        ui.toggleRightSidebar();
        zapChannel(-1);
        break;
      default:
        break;
    }
    return;
  }

  if (ui.isSidebarOpen()) {
    const mode = ui.getSidebarMode();
    if (mode === 'search') {
      switch (action) {
        case 'up':
          ui.searchNavigate(-1);
          break;
        case 'down':
          ui.searchNavigate(1);
          break;
        case 'select':
          ui.searchSelect();
          break;
        case 'back':
          ui.exitSearch();
          break;
        case 'number':
          break; // typed into the search box natively
        default:
          break;
      }
      return;
    }
    if (mode === 'groups') {
      switch (action) {
        case 'up':
          ui.navigateGroupUp();
          break;
        case 'down':
          ui.navigateGroupDown();
          break;
        case 'channelUp':
          ui.navigateGroupDown();
          break;
        case 'channelDown':
          ui.navigateGroupUp();
          break;
        case 'select':
          ui.selectFocusedGroup();
          break;
        case 'left':
          break;
        case 'right':
          ui.toggleSidebar();
          ui.toggleRightSidebar();
          break;
        case 'back':
          ui.toggleSidebar();
          break;
        case 'number':
          ui.jumpToNumber(value);
          break;
        default:
          break;
      }
    } else {
      switch (action) {
        case 'up':
          ui.navigateUp();
          break;
        case 'down':
          ui.navigateDown();
          break;
        case 'channelUp':
          ui.navigateDown();
          break;
        case 'channelDown':
          ui.navigateUp();
          break;
        case 'select':
          ui.selectFocused();
          break;
        case 'left':
          if (ui.getGroups().length > 0) {
            ui.showGroupList();
          } else {
            ui.toggleSidebar();
          }
          break;
        case 'right':
          ui.toggleSidebar();
          ui.toggleRightSidebar();
          break;
        case 'back':
          ui.toggleSidebar();
          break;
        case 'playpause':
          player.togglePlay();
          break;
        case 'number':
          ui.jumpToNumber(value);
          break;
        case 'reload':
          player.reloadChannel();
          break;
        default:
          break;
      }
    }
    state.selectedGroup = ui.getSelectedGroup();
    state.currentIndex = ui.getCurrentIndex();
    return;
  }

  switch (action) {
    case 'up':
    case 'prev':
      zapChannel(-1);
      break;
    case 'down':
    case 'next':
    case 'channelUp':
      zapChannel(1);
      break;
    case 'channelDown':
      zapChannel(-1);
      break;
    case 'left':
      ui.toggleSidebar();
      break;
    case 'right':
      ui.toggleRightSidebar();
      break;
    case 'select':
      ui.toggleSidebar();
      break;
    case 'back':
      ui.showConfirmDialog('Exit the app?', (confirmed) => {
        if (confirmed) {
          if (capabilities().hasApplicationControl) {
            try {
              window.tizen.application.getCurrentApplication().exit();
            } catch {}
          } else {
            window.close();
          }
        }
      });
      break;
    case 'playpause':
    case 'play':
    case 'pause':
      player.togglePlay();
      break;
    case 'stop':
      player.stop();
      ui.showEmptyLogo('Playback stopped — pick a channel to watch');
      ui.toggleSidebar();
      break;
    case 'red':
      // Reserved for future use
      break;
    case 'green':
      if (!ui.isSidebarOpen()) {
        ui.toggleSidebar();
      } else if (ui.getSidebarMode() !== 'groups' && ui.getGroups().length > 0) {
        ui.showGroupList();
      }
      break;
    case 'yellow':
      // Reserved for future use
      break;
    case 'blue':
      showSettingsPage();
      break;
    case 'number':
      ui.jumpToNumber(value, true);
      break;
    case 'reload':
      player.reloadChannel();
      break;
    default:
      break;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => deps.init());
} else {
  deps.init();
}
