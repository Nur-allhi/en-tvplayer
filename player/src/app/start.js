// Startup orchestration (T-152c). Boots the player, schedules the update
// check, and replays the last session. All calls back into sibling slices
// go through deps so this file never imports main.js (the hub until T-152).
import { getSettings, getActivePlaylist, saveSettings, getHiddenGroups } from '../config.js';
import { fetchPlaylistWithRetry } from '../utils.js';
import { findResumeIndex } from '../logic.js';
import { checkForUpdate, sendUsagePing, consentAsked, hasConsented, setConsented } from '../update.js';
import * as player from '../player/index.js';
import * as remote from '../remote.js';
import * as ui from '../ui/index.js';
import { installBackKey } from '../features/tizen-compat.js';
import { capabilities } from '../capabilities.js';
import { fallbackNotice } from '../lib/engine-notice.js';
import { showBootSplash } from './boot.js';
import { state, BOOT_IDLE_HOLD_MS } from './state.js';
import { deps } from './deps.js';

async function init() {
  const videoEl = document.getElementById('video');

  // Engine fallback notice (T-191): never leave a blank screen. The support
  // check is sync; a failed async attach is handled below via the returned
  // promise instead of the old dead `if (!initPlayer())` branch.
  const avplayAvailable = capabilities().hasAvplay === true;

  // initPlayer resolves false when Shaka is unusable OR its attach fails —
  // the only real signals available at boot (T-191). Pick the fallback from
  // that result and show it on an existing visible surface, never a blank
  // screen and never by replacing the whole document.
  player.initPlayer(videoEl).then((ok) => {
    if (ok !== false) return;
    const decision = fallbackNotice(false, avplayAvailable);
    if (decision.mode === 'native') ui.showTransientNotice(decision.notice, 8000);
    ui.showEmptyLogo(decision.notice);
    deps.hideBootSplashAndMaybeWhatsNew(0);
  });

  remote.init((...args) => deps.handleRemoteAction(...args));

  deps.registerTizenKeys();

  // Update checker (from feature/update-check): opt-in prompt + background
  // version check. Was defined but never invoked — wire it at boot.
  scheduleUpdateCheck();

  installBackKey((action) => deps.handleRemoteAction(action));

  const s = getSettings();
  const activePlaylist = getActivePlaylist();

  const autoRefresh = s.autoRefreshPlaylist !== false;

  if (autoRefresh && activePlaylist && activePlaylist.url) {
    // Auto-refresh: always fetch fresh playlist on boot.
    if (s.channels && s.channels.length > 0) {
      // Cached channels available — show instantly, refresh in background.
      state.channels = s.channels;
      deps.startPlayer();
      showBootSplash('Updating playlist...');
      deps.refreshChannelsInBackground().then((ok) => {
        deps.hideBootSplashAndMaybeWhatsNew(0, () => {
          if (ok === false) deps.showStaleCacheNotice();
        });
      });
    } else {
      // No cached channels — show splash while fetching (with retries).
      showBootSplash('Downloading playlist...');
      try {
        const newChannels = await fetchPlaylistWithRetry(activePlaylist);
        saveSettings({ channels: newChannels, channelsFetched: new Date().toISOString() });
        state.channels = newChannels;
        deps.hideBootSplashAndMaybeWhatsNew();
        deps.startPlayer();
      } catch (e) {
        console.warn('Failed to fetch playlist:', e.message);
        deps.hideBootSplashAndMaybeWhatsNew();
        deps.showFirstRun();
      }
    }
  } else if (s.channels && s.channels.length > 0) {
    // Auto-refresh OFF: load from localStorage only, no network fetch —
    // hold the splash 1.5s past the tagline so it doesn't flash by.
    state.channels = s.channels;
    deps.startPlayer();
    showBootSplash('Loading...');
    deps.hideBootSplashAndMaybeWhatsNew(BOOT_IDLE_HOLD_MS);
  } else if (activePlaylist && activePlaylist.url) {
    // No cached channels but has playlist URL — fetch once to bootstrap.
    showBootSplash('Loading playlist...');
    try {
      const newChannels = await fetchPlaylistWithRetry(activePlaylist);
      saveSettings({ channels: newChannels, channelsFetched: new Date().toISOString() });
      state.channels = newChannels;
      deps.hideBootSplashAndMaybeWhatsNew();
      deps.startPlayer();
    } catch (e) {
      console.warn('Failed to fetch playlist:', e.message);
      deps.hideBootSplashAndMaybeWhatsNew();
      deps.showFirstRun();
    }
  } else {
    deps.showFirstRun();
  }
}
function restoreLastSession() {
  let idx = 0;
  try {
    const s = getSettings();
    const at = findResumeIndex(state.channels, s && s.lastChannelUrl, getHiddenGroups());
    if (at >= 0) {
      const ch = state.channels[at];
      const g = (ch && ch.group) || 'Ungrouped';
      idx = at;
      const groups = ui.getGroups().map((x) => x.name);
      const savedView = s.lastGroup === 'all' ? 'All Channels' : s.lastGroup;
      if (savedView && groups.includes(savedView) && (savedView === 'All Channels' || savedView === g)) {
        ui.showGroupChannels(savedView);
      } else if (groups.includes(g)) {
        ui.showGroupChannels(g);
      } else {
        ui.showGroupChannels('All Channels');
      }
      state.selectedGroup = ui.getSelectedGroup();
    }
  } catch {}
  ui.selectChannel(idx, true);
}
function runUpdateCheck() {
  sendUsagePing();
  checkForUpdate().then((info) => {
    if (info) {
      state.pendingUpdate = info;
      ui.setUpdateBadge(true);
    }
  });
}

// Gentle, non-blocking: ask once, otherwise check silently in background.
function scheduleUpdateCheck() {
  setTimeout(() => {
    if (!consentAsked()) {
      ui.showConfirmDialog(
        'Check for app updates on launch? Anonymous version check only — no personal data.',
        (ok) => {
          setConsented(ok === true);
          if (ok === true) runUpdateCheck();
        },
      );
    } else if (hasConsented()) {
      runUpdateCheck();
    }
  }, 1500);
}

// Self-register so the hub and sibling slices reach these through slots.
Object.assign(deps, {
  init,
  restoreLastSession,
  scheduleUpdateCheck,
});
