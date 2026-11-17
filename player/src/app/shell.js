// Player shell wiring (T-152c). startPlayer builds the UI/settings/plugins
// surface and registers every playback listener. Kept separate from boot
// orchestration so each file stays under the 300 LOC modularity cap.
import { getSettings, saveSettings, getActivePlaylist } from '../config.js';
import * as player from '../player/index.js';
import * as ui from '../ui/index.js';
import * as settings from '../settings/index.js';
import { state } from './state.js';
import { deps } from './deps.js';
import { mediaToChannel } from '../lib/media-channel.js';
import { rememberVod, restoreVod } from './vod-resume.js';

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
function startPlayer() {
  // BUG-018: must also initialize the shell with zero channels. Otherwise a
  // fresh install that backs out of Settings lands on a dead player page
  // (no UI wiring, Settings unreachable).
  state.channels = state.channels || [];

  cleanupEventListeners();
  deps.sortChannels(state.channels);

  settings.init(document.getElementById('settings-page'), {
    onPlaylistFetched: (newChannels) => {
      deps.sortChannels(newChannels);
      state.channels = newChannels;
      ui.refreshChannelList(state.channels);
      settings.hide();
      ui.stopInactivityTimer();
      deps.refreshProxyMenu();
      deps.showPlayer();
    },
    onClose: () => {
      settings.hide();
      ui.stopInactivityTimer();
      deps.refreshProxyMenu();
      ui.refreshGroupVisibility();
      state.selectedGroup = ui.getSelectedGroup();
      deps.showPlayer();
    },
  });

  ui.init(state.channels, (...args) => deps.handleChannelSelect(...args));

  const overlaySettings = getSettings();
  ui.setOverlayVisibility({
    watermark: overlaySettings.showWatermark !== false,
    badge: overlaySettings.showResolutionBadge !== false,
  });

  ui.setAutoCloseCallback(() => {
    if (settings.isVisible()) {
      settings.hide();
      deps.refreshProxyMenu();
      ui.refreshGroupVisibility();
      state.selectedGroup = ui.getSelectedGroup();
      deps.showPlayer();
      ui.stopInactivityTimer();
    }
  });
  ui.setResolutionCallback((height) => {
    player.selectResolution(height);
    deps.updateResolutionBadge(height || player.getActiveHeight());
  });

  ui.setAudioCallback((id) => {
    player.selectAudioTrackById(id);
    ui.setSelectedAudio(id);
  });

  ui.setSubtitleCallback((id) => player.selectTextTrackById(id));
  ui.initSubtitlePicker();

  ui.setMediaPlayCallback((entry, episode, at) => {
    rememberVod(entry, episode);
    restoreVod(at);
    deps.handleChannelSelect(mediaToChannel(entry, episode));
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
      deps.showProgress('Reloading');
      player.reloadChannel();
    });
  }
  let refreshChannelsBtn = document.getElementById('refresh-channels-btn');
  if (refreshChannelsBtn) {
    addCleanupListener(refreshChannelsBtn, 'click', async () => {
      deps.showProgress('Refreshing');
      await deps.refreshChannels();
      deps.hideProgress();
    });
  }

  let settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    addCleanupListener(settingsBtn, 'click', () => {
      deps.showSettingsPage();
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
  deps.refreshProxyMenu();

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
    deps.hideProgress();
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
      deps.updateProgressPercent(p);
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
    deps.updateResolutionBadge(height, bandwidth);
    ui.setSelectedAudio(player.getActiveAudioId());
  });

  player.onChannelAdvance(() => {
    const next = (state.currentIndex + 1) % state.channels.length;
    ui.selectChannel(next);
  });

  player.onTokenExpired((deadChannel) => {
    deps.handleStaleToken(deadChannel);
  });

  if (state.channels.length === 0) {
    showEmptyState();
    return;
  }
  deps.restoreLastSession();
}

// Boot resume: replay the last channel + group view instead of channel 0.
// Falls back to channel 0 when nothing was saved, the channel is gone, or
// its group is now hidden. Identity is the channel URL (stable across
function showEmptyState() {
  deps.showPlayer();
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

// Self-register so the hub and sibling slices reach these through slots.
Object.assign(deps, {
  startPlayer,
});
