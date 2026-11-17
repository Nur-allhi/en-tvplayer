import { getSettings, saveSettings, getActivePlaylist, getHiddenGroups } from './config.js';
import * as player from './player/index.js';
import * as ui from './ui/index.js';
import * as remote from './remote.js';
import * as settings from './settings/index.js';
import { checkForUpdate, sendUsagePing, consentAsked, hasConsented, setConsented } from './update.js';
import { fetchPlaylistEntry, fetchPlaylistWithRetry } from './utils.js';
import { filterDisplayChannels, findResumeIndex, findIntentIndex, tuneSuperseded } from './logic.js';
import { capabilities } from './capabilities.js';
import { hasTvKeyInput } from './lib/capabilities.js';
// T-150/T-152b: boot staging and the first-run/What's New slices.
import { showBootSplash, hideBootSplash } from './app/boot.js';
import { state, BOOT_IDLE_HOLD_MS } from './app/state.js';
import { deps } from './app/deps.js';
// Side-effect imports: each slice self-registers its functions into deps.
import './app/onboarding.js';
import './app/whats-new.js';

// The hub still owns these implementations until T-152 moves them to
// app/start.js. Slices call back through these slots; wiring here (rather
// than importing main.js) is what keeps the app graph acyclic.
Object.assign(deps, {
  showBootSplash,
  hideBootSplash,
  startPlayer: (...args) => startPlayer(...args),
  showSettingsPage: (...args) => showSettingsPage(...args),
});

/* Responsive TV scaling: detect screen size and set CSS variable */
function applyResponsiveScale() {
  const sw = screen.width || 1920;
  const sh = screen.height || 1080;
  const scale = Math.max(sw / 1920, sh / 1080, 1.35);
  document.documentElement.style.setProperty('--tv-scale', scale);
}
applyResponsiveScale();

function getDisplayChannels() {
  return filterDisplayChannels(state.channels, getHiddenGroups(), state.selectedGroup);
}

async function init() {
  const videoEl = document.getElementById('video');
  if (!player.initPlayer(videoEl)) {
    document.body.innerHTML =
      '<div style="text-align:center;padding:40px;color:#fff;">' +
      '<h2>App cannot start</h2>' +
      '<p>Your device does not support the video playback needed for this app. Please try restarting the app or updating your TV software.</p>' +
      '</div>';
    return;
  }

  remote.init(handleRemoteAction);

  registerTizenKeys();

  // Update checker (from feature/update-check): opt-in prompt + background
  // version check. Was defined but never invoked — wire it at boot.
  scheduleUpdateCheck();

  document.addEventListener('tizenhwkey', (e) => {
    if (e.keyName === 'back') {
      e.preventDefault();
      handleRemoteAction('back');
    }
  });

  const s = getSettings();
  const activePlaylist = getActivePlaylist();

  const autoRefresh = s.autoRefreshPlaylist !== false;

  if (autoRefresh && activePlaylist && activePlaylist.url) {
    // Auto-refresh: always fetch fresh playlist on boot.
    if (s.channels && s.channels.length > 0) {
      // Cached channels available — show instantly, refresh in background.
      state.channels = s.channels;
      startPlayer();
      showBootSplash('Updating playlist...');
      refreshChannelsInBackground().then((ok) => {
        deps.hideBootSplashAndMaybeWhatsNew(0, () => {
          if (ok === false) showStaleCacheNotice();
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
        startPlayer();
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
    startPlayer();
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
      startPlayer();
    } catch (e) {
      console.warn('Failed to fetch playlist:', e.message);
      deps.hideBootSplashAndMaybeWhatsNew();
      deps.showFirstRun();
    }
  } else {
    deps.showFirstRun();
  }
}

function cleanupEventListeners() {
  state.cleanupListeners.forEach(({ element, event, handler }) => {
    if (element && element.removeEventListener) {
      element.removeEventListener(event, handler);
    }
  });
  state.cleanupListeners = [];
  if (state.bufferingInterval) {
    clearInterval(state.bufferingInterval);
    state.bufferingInterval = null;
  }
}

function addCleanupListener(element, event, handler) {
  if (element && element.addEventListener) {
    element.addEventListener(event, handler);
    state.cleanupListeners.push({ element, event, handler });
  }
}

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

function startPlayer() {
  // BUG-018: must also initialize the shell with zero channels. Otherwise a
  // fresh install that backs out of Settings lands on a dead player page
  // (no UI wiring, Settings unreachable).
  state.channels = state.channels || [];

  cleanupEventListeners();
  sortChannels(state.channels);

  settings.init(document.getElementById('settings-page'), {
    onPlaylistFetched: (newChannels) => {
      sortChannels(newChannels);
      state.channels = newChannels;
      ui.refreshChannelList(state.channels);
      settings.hide();
      ui.stopInactivityTimer();
      refreshProxyMenu();
      showPlayer();
    },
    onClose: () => {
      settings.hide();
      ui.stopInactivityTimer();
      refreshProxyMenu();
      ui.refreshGroupVisibility();
      state.selectedGroup = ui.getSelectedGroup();
      showPlayer();
    },
  });

  ui.init(state.channels, handleChannelSelect);

  const overlaySettings = getSettings();
  ui.setOverlayVisibility({
    watermark: overlaySettings.showWatermark !== false,
    badge: overlaySettings.showResolutionBadge !== false,
  });

  ui.setAutoCloseCallback(() => {
    if (settings.isVisible()) {
      settings.hide();
      refreshProxyMenu();
      ui.refreshGroupVisibility();
      state.selectedGroup = ui.getSelectedGroup();
      showPlayer();
      ui.stopInactivityTimer();
    }
  });
  ui.setResolutionCallback((height) => {
    player.selectResolution(height);
    updateResolutionBadge(height || player.getActiveHeight());
  });

  ui.setAudioCallback((id) => {
    player.selectAudioTrackById(id);
    ui.setSelectedAudio(id);
  });

  let playPauseButton = document.getElementById('playpause-button');
  if (playPauseButton) {
    addCleanupListener(playPauseButton, 'click', (e) => {
      e.stopPropagation();
      player.togglePlay();
    });
  }

  let refreshStreamBtn = document.getElementById('refresh-stream-btn');
  if (refreshStreamBtn) {
    addCleanupListener(refreshStreamBtn, 'click', () => {
      showProgress('Reloading');
      player.reloadChannel();
    });
  }
  let refreshChannelsBtn = document.getElementById('refresh-channels-btn');
  if (refreshChannelsBtn) {
    addCleanupListener(refreshChannelsBtn, 'click', async () => {
      showProgress('Refreshing');
      await refreshChannels();
      hideProgress();
    });
  }

  let settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    addCleanupListener(settingsBtn, 'click', () => {
      showSettingsPage();
    });
  }

  const onboardM3u = document.getElementById('onboard-m3u');
  if (onboardM3u) {
    addCleanupListener(onboardM3u, 'click', () => {
      state.onboardFocus = 0;
      deps.selectOnboarding();
    });
  }
  const onboardXtream = document.getElementById('onboard-xtream');
  if (onboardXtream) {
    addCleanupListener(onboardXtream, 'click', () => {
      state.onboardFocus = 1;
      deps.selectOnboarding();
    });
  }

  // Desktop test relay toggle: visible only on local test hosts (localhost,
  // loopback, .local, LAN IPs — never in the TV build, which runs from
  // file:// with an empty hostname) AND when enabled in Settings → Playback.
  // Off by default, so release users never see it.
  refreshProxyMenu();

  let proxyToggleBtn = document.getElementById('proxy-toggle-btn');
  if (proxyToggleBtn) {
    addCleanupListener(proxyToggleBtn, 'click', () => {
      const ch = ui.getCurrentChannel();
      if (!ch) return;
      const s = getSettings();
      const map = { ...(s.proxyChannels || {}) };
      const on = !map[ch.url];
      if (on) map[ch.url] = true;
      else delete map[ch.url];
      saveSettings({ proxyChannels: map });
      ch.useProxy = on;
      ui.setProxyToggleLabel(on);
      player.reloadChannel();
    });
  }

  let videoEl = document.getElementById('video');
  addCleanupListener(videoEl, 'playing', () => {
    state.playbackStarted = true;
    videoEl.style.visibility = '';
    hideProgress();
    ui.hideBuffering();
    ui.hideEmptyLogo();
  });
  addCleanupListener(videoEl, 'click', () => player.togglePlay());

  addCleanupListener(videoEl, 'play', () => {
    let btn = document.getElementById('playpause-button');
    if (btn) btn.innerHTML = '&#10073;&#10073;';
  });
  addCleanupListener(videoEl, 'pause', () => {
    let btn = document.getElementById('playpause-button');
    if (btn) btn.innerHTML = '&#9654;';
  });

  addCleanupListener(document, 'fullscreenchange', () => {
    if (!document.fullscreenElement && ui.isFullscreenMode()) {
      ui.exitFullscreenMode();
    }
  });

  player.onBuffering((buffering, percent) => {
    state.bufferingActive = buffering;
    if (buffering) {
      const p = percent != null ? percent : player.getBufferingPercent();
      ui.showBuffering(p);
      updateProgressPercent(p);
    } else {
      ui.hideBuffering();
    }
  });
  // Silent-retry counter for the single-narrative status line.
  player.onTuneAttempt((n) => {
    ui.setTuneAttempt(n);
  });
  state.bufferingInterval = setInterval(() => {
    if (state.bufferingActive) {
      ui.updateBuffering(player.getBufferingPercent());
    }
  }, 500);

  player.onTrackChange(({ height, bandwidth }) => {
    updateResolutionBadge(height, bandwidth);
    ui.setSelectedAudio(player.getActiveAudioId());
  });

  player.onChannelAdvance(() => {
    const next = (state.currentIndex + 1) % state.channels.length;
    ui.selectChannel(next);
  });

  player.onTokenExpired((deadChannel) => {
    handleStaleToken(deadChannel);
  });

  if (state.channels.length === 0) {
    showEmptyState();
    return;
  }
  restoreLastSession();
}

// Boot resume: replay the last channel + group view instead of channel 0.
// Falls back to channel 0 when nothing was saved, the channel is gone, or
// its group is now hidden. Identity is the channel URL (stable across
// playlist refresh and re-sort); a raw index would rot on every fetch.
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

function showEmptyState() {
  showPlayer();
  const active = getActivePlaylist();
  ui.showEmptyLogo(
    !active || !active.url
      ? 'No playlist yet — open Settings to add one and start watching'
      : 'This playlist has no channels — check the URL or try another',
  );
  const nameEl = document.getElementById('channel-name');
  if (nameEl) nameEl.textContent = 'No channels';
  const infoEl = document.getElementById('channel-info');
  if (infoEl) infoEl.textContent = 'Open Settings to add a playlist';
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
function forcePaint() {
  try {
    void document.body.offsetHeight;
  } catch {}
}

async function handleChannelSelect(channel) {
  // Record the tune intent FIRST (before the paint-delay await below): the
  // background refresh may land while this tune is still yielding, and it
  // needs the latest intent to decide on a fresh-URL re-tune.
  const mySeq = ++state.tuneSeq;
  state.currentIndex = state.channels.indexOf(channel);
  // Latest tune intent (name+group survive token rotation; URLs don't).
  state.lastIntent = { name: channel.name, group: channel.group || 'Ungrouped' };
  // Hard visual reset FIRST: one clean narrative (name + Connecting…),
  // every stale pill/error/progress from the previous tune hidden at once.
  ui.resetTuneStatus(channel && channel.name);
  hideProgress();
  ui.setAudioTracks([]);
  // Force the veil + name through layout before the teardown/load below
  // runs — on Tizen the first paint can otherwise stall until load
  // resolves, leaving a bare logo with no indication of what's happening.
  forcePaint();
  // Drop the video plane at once: on Tizen it renders above the web layer,
  // so without this the old/black frame covers the loading veil.
  const tuneVideo = document.getElementById('video');
  if (tuneVideo) tuneVideo.style.visibility = 'hidden';
  // Let the veil paint before the teardown/load below blocks the main thread.
  // On TV the first paint can otherwise only happen after load resolves,
  // so users see black instead of the spinner + name.
  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    try {
      requestAnimationFrame(() => setTimeout(finish, 30));
    } catch {
      finish();
    }
    setTimeout(finish, 350); // safety: never stall tuning
  });
  // Fast-zap burst: a newer press arrived while the veil was painting — the
  // player belongs to it now, so bail before touching anything. The UI above
  // already shows the latest channel; only the load is skipped.
  if (tuneSuperseded(mySeq, state.tuneSeq)) return;
  // Stamp the active playlist so Channel Source cards can show "last played".
  try {
    const s = getSettings();
    const idx = s.activePlaylistIndex;
    if (s.playlists[idx]) {
      s.playlists[idx].lastPlayedAt = new Date().toISOString();
      saveSettings({ playlists: s.playlists });
    }
  } catch {}
  // Resume: remember what was playing (URL is stable across refresh/sort).
  try {
    state.selectedGroup = ui.getSelectedGroup();
    saveSettings({ lastChannelUrl: channel.url, lastGroup: state.selectedGroup });
  } catch {}
  ui.setProxyToggleLabel(!!(getSettings().proxyChannels || {})[channel.url]);
  const ok = await player.loadChannel(channel);
  state.tuneSucceeded = ok === true;
  if (!ok) {
    hideProgress();
    ui.hideBuffering();
    ui.showEmptyLogo('');
  } else if (!state.bufferingActive) {
    // Fast channel: loaded with nothing left to buffer — drop the name toast.
    ui.hideBuffering();
  } else {
    // Still buffering after load: veil is gone, first frame not up yet.
    // Keep the center brand with the channel name under it until playback.
    ui.showEmptyLogo(channel.name);
  }
  ui.setSelectedResolution('auto');
  const p = player.getPlayer();
  if (p) {
    ui.setResolutions(player.getResolutions());
    ui.setAudioTracks(player.getAudioTracks());
    const height = player.getActiveHeight();
    if (height) updateResolutionBadge(height);
  }
}

const labelMap = [
  [480, 'SD'],
  [720, 'HD'],
  [1080, 'FHD'],
  [1440, '2K'],
  [2160, '4K'],
];

function getResolutionLabel(height) {
  if (!height) return 'Auto';
  for (const [max, label] of labelMap) {
    if (height <= max) return label;
  }
  return '8K';
}

function formatBandwidth(bps) {
  if (!bps || bps <= 0) return '';
  const mbps = (bps / 1000000).toFixed(1);
  return ' \u2022 ' + mbps + ' Mbps';
}

function channelTypeTag(channel) {
  if (!channel || !channel.url) return '';
  const ext = channel.url.split('?')[0].split('.').pop().trim().toUpperCase();
  if (!ext || ext.length > 5 || ext.includes('/')) return '';
  return ' \u2022 ' + ext;
}

function updateResolutionBadge(height, bandwidth) {
  const el = document.getElementById('resolution-badge');
  if (!el) return;
  if (getSettings().showResolutionBadge === false) {
    el.classList.add('hidden');
    return;
  }
  const label = getResolutionLabel(height);
  const bw = bandwidth || player.getActiveBandwidth();
  const type = channelTypeTag(state.channels[state.currentIndex]);
  el.textContent = label + formatBandwidth(bw) + type;
  el.classList.remove('hidden');
}

function showProgress(text) {
  const el = document.getElementById('progress-toast');
  if (!el) return;
  state.progressActive = true;
  el.classList.remove('hidden');
  document.getElementById('progress-text').textContent = text;
}

function updateProgressPercent(percent) {
  if (!state.progressActive) return;
  const el = document.getElementById('progress-text');
  if (el && typeof percent === 'number') {
    el.textContent = 'Reloading ' + percent + '%';
  }
}

function hideProgress() {
  state.progressActive = false;
  const el = document.getElementById('progress-toast');
  if (el) el.classList.add('hidden');
}

async function refreshChannelsInBackground() {
  const active = getActivePlaylist();
  if (!active || !active.url) return true;
  try {
    const newChannels = await fetchPlaylistWithRetry(active);
    applyFreshChannels(newChannels);
    // The boot tune ran on pre-refresh (possibly stale-token) URLs. If it
    // never got anywhere, re-tune the same channel with its fresh URL
    // instead of stranding the user on the brand screen. Working playback
    // is never touched.
    if (!state.playbackStarted && !state.tuneSucceeded && state.lastIntent) {
      const at = findIntentIndex(state.channels, state.lastIntent);
      if (at >= 0) ui.selectChannel(at, true);
    }
    return true;
  } catch (e) {
    console.warn('Background playlist refresh failed:', e.message);
    return false;
  }
}

// Swap in a freshly fetched channel list (persist + sort + repaint).
function applyFreshChannels(newChannels) {
  saveSettings({ channels: newChannels, channelsFetched: new Date().toISOString() });
  sortChannels(newChannels);
  state.channels = newChannels;
  ui.refreshChannelList(state.channels);
}

// Expired-token recovery: the player retried the frozen channel URL and the
// server still says 403/401, so mint a fresh link via the playlist instead.
// Re-tunes by name+group (URLs rotate); falls back to one last same-URL
// load (no budget reset) so the normal advance path ends it if the link is
// truly dead. Never yanks the user back if they already moved on.
async function handleStaleToken(deadChannel) {
  try {
    if (!deadChannel || !state.lastIntent) return;
    const deadGroup = deadChannel.group || 'Ungrouped';
    if (deadChannel.name !== state.lastIntent.name || deadGroup !== state.lastIntent.group) return;
    let fresh = null;
    try {
      const active = getActivePlaylist();
      if (active && active.url) fresh = await fetchPlaylistWithRetry(active);
    } catch (e) {
      console.warn('Stale-token playlist refetch failed:', e.message);
    }
    if (fresh) {
      applyFreshChannels(fresh);
      const at = findIntentIndex(state.channels, state.lastIntent);
      if (at >= 0 && state.channels[at].url !== deadChannel.url) {
        ui.selectChannel(at, true);
        return;
      }
    }
    player.loadChannel(deadChannel);
  } catch (e) {
    console.warn('Stale-token recovery failed:', e.message);
  }
}

// Background refresh failed after retries: the cached list is still on
// screen — say so (with its date) instead of failing silently.
function showStaleCacheNotice() {
  let when = '';
  try {
    const iso = getSettings().channelsFetched;
    if (iso) when = ' from ' + new Date(iso).toLocaleDateString();
  } catch {}
  ui.showTransientNotice('Playlist update failed — using saved list' + when);
}

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
  const displayChannels = getDisplayChannels();
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
          startPlayer();
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

function sortChannels(ch) {
  if (!ch || !ch.length) return;
  // Provider order (default): keep playlist file order. A–Z is opt-in.
  if (getSettings().channelSort !== 'name') return;
  ch.sort((a, b) => {
    if (!a || !b) return 0;
    // Sort by group first, then alphabetically by name within group
    const aGroup = (a.group || 'Ungrouped').toLowerCase();
    const bGroup = (b.group || 'Ungrouped').toLowerCase();
    if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
    return (a.name || '').localeCompare(b.name || '');
  });
}

export async function refreshChannels() {
  const active = getActivePlaylist();
  if (active && active.url) {
    try {
      const newChannels = await fetchPlaylistEntry(active);
      saveSettings({ channels: newChannels, channelsFetched: new Date().toISOString() });
      sortChannels(newChannels);
      state.channels = newChannels;
      ui.refreshChannelList(state.channels);
    } catch (e) {
      console.warn('Failed to refresh from playlist:', e.message);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
