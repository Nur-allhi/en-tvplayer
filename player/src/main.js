import { getSettings, saveSettings, getProxyOverrides, getActivePlaylist } from './config.js';
import * as player from './player.js';
import * as ui from './ui.js';
import * as remote from './remote.js';
import * as settings from './settings.js';
import { processStreamUrl, parseM3u, fetchPlaylist as fetchFromPlaylistUrl } from './utils.js';

let currentIndex = 0;
let channels;
let selectedGroup = null;
let bufferingInterval = null;
let cleanupListeners = [];
let pendingPreview = null;


/* Responsive TV scaling: detect screen size and set CSS variable */
function applyResponsiveScale() {
  const sw = screen.width || 1920;
  const sh = screen.height || 1080;
  const scale = Math.max(sw / 1920, sh / 1080, 1.35);
  document.documentElement.style.setProperty("--tv-scale", scale);
}
applyResponsiveScale();

function getDisplayChannels() {
  if (selectedGroup === 'all' || !selectedGroup) return channels;
  return channels.filter(ch => (ch.group || 'Ungrouped') === selectedGroup);
}

async function init() {
  const videoEl = document.getElementById('video');
  if (!player.initPlayer(videoEl)) {
    document.body.innerHTML =
      '<div style="text-align:center;padding:40px;color:#fff;">' +
      '<h2>Browser Not Supported</h2>' +
      '<p>This browser does not support MSE/EME required for streaming.</p>' +
      '</div>';
    return;
  }

  remote.init(handleRemoteAction);

  registerTizenKeys();

  document.addEventListener('tizenhwkey', (e) => {
    if (e.keyName === 'back') {
      e.preventDefault();
      handleRemoteAction('back');
    }
  });

  const s = getSettings();
  const activePlaylist = getActivePlaylist();

  // Cache-first boot: show cached channels instantly, refresh in background.
  // A hung playlist fetch must never block boot (TV network may not be ready).
  if (s.channels && s.channels.length > 0) {
    channels = s.channels;
    startPlayer();
    if (activePlaylist && activePlaylist.url) {
      refreshChannelsInBackground();
    }
  } else if (activePlaylist && activePlaylist.url) {
    try {
      const newChannels = await fetchFromPlaylistUrl(activePlaylist.url);
      applyProxyOverrides(newChannels);
      saveSettings({ channels: newChannels, channelsFetched: new Date().toISOString() });
      channels = newChannels;
      startPlayer();
    } catch (e) {
      console.warn('Failed to fetch playlist:', e.message);
      showFirstLaunch();
    }
  } else {
    showFirstLaunch();
  }


}

function cleanupEventListeners() {
  cleanupListeners.forEach(({ element, event, handler }) => {
    if (element && element.removeEventListener) {
      element.removeEventListener(event, handler);
    }
  });
  cleanupListeners = [];
  if (bufferingInterval) {
    clearInterval(bufferingInterval);
    bufferingInterval = null;
  }
}

function addCleanupListener(element, event, handler) {
  if (element && element.addEventListener) {
    element.addEventListener(event, handler);
    cleanupListeners.push({ element, event, handler });
  }
}

function startPlayer() {
  if (!channels || channels.length === 0) {
    showFirstLaunch();
    return;
  }

  cleanupEventListeners();
  sortChannels(channels);

  settings.init(document.getElementById('settings-page'), {
    onPlaylistFetched: (newChannels) => {
      sortChannels(newChannels);
      applyProxyOverrides(newChannels);
      channels = newChannels;
      ui.refreshChannelList(channels);
      settings.hide();
      ui.stopInactivityTimer();
      showPlayer();
    },
    onClose: () => {
      settings.hide();
      ui.stopInactivityTimer();
      showPlayer();
    },
  });

  ui.init(channels, handleChannelSelect);

  ui.setAutoCloseCallback(() => {
    if (settings.isVisible()) {
      settings.hide();
      showPlayer();
      ui.stopInactivityTimer();
    }
  });

  ui.setResolutionCallback((height) => {
    player.selectResolution(height);
    updateResolutionBadge(height || player.getActiveHeight());
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

  let toggleProxyBtn = document.getElementById('toggle-proxy-btn');
  if (toggleProxyBtn) {
    addCleanupListener(toggleProxyBtn, 'click', () => {
      ui.toggleCurrentChannelProxy();
    });
  }

  let settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    addCleanupListener(settingsBtn, 'click', () => {
      showSettingsPage();
    });
  }

  let videoEl = document.getElementById('video');
  addCleanupListener(videoEl, 'playing', () => hideProgress());
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

  let bufferingActive = false;
  player.onBuffering((buffering, percent) => {
    bufferingActive = buffering;
    if (buffering) {
      const p = percent != null ? percent : player.getBufferingPercent();
      ui.showBuffering(p);
      updateProgressPercent(p);
    } else {
      ui.hideBuffering();
    }
  });
  bufferingInterval = setInterval(() => {
    if (bufferingActive) {
      ui.updateBuffering(player.getBufferingPercent());
    }
  }, 500);

  player.onTrackChange(({ height, bandwidth }) => updateResolutionBadge(height, bandwidth));

  player.onChannelAdvance(() => {
    const next = (currentIndex + 1) % channels.length;
    ui.selectChannel(next);
  });

  player.onProxySuggestion(() => {
    ui.showProxyToast();
  });

  ui.setProxyToggleCallback(() => {
    player.reloadChannel();
  });

  ui.selectChannel(0, true);
}

function showFirstLaunch() {
  hidePlayer();

  settings.init(document.getElementById('settings-page'), {
    onPlaylistFetched: (newChannels) => {
      try {
        sortChannels(newChannels);
        applyProxyOverrides(newChannels);
        channels = newChannels;
        settings.hide();
        showPlayer();
        startPlayer();
      } catch (e) {
        console.error('Failed to start player after fetch:', e);
      }
    },
    onClose: () => {
      if (channels && channels.length > 0) {
        settings.hide();
        showPlayer();
      }
    },
  });

  document.body.style.overflow = 'hidden';
  settings.show();
}

function showPlayer() {
  document.body.style.overflow = '';
  const playerContainer = document.getElementById('player-container');
  const nowPlaying = document.getElementById('now-playing');
  if (playerContainer) playerContainer.classList.remove('hidden');
  if (nowPlaying) nowPlaying.classList.remove('hidden');
  ui.showSidebarWithContent();
}

function hidePlayer() {
  const playerContainer = document.getElementById('player-container');
  const nowPlaying = document.getElementById('now-playing');
  const sidebar = document.getElementById('sidebar');
  if (playerContainer) playerContainer.classList.add('hidden');
  if (nowPlaying) nowPlaying.classList.add('hidden');
  if (sidebar) sidebar.classList.add('closed');
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

async function handleChannelSelect(channel) {
  ui.hideProxyToast();
  currentIndex = channels.indexOf(channel);
  const ok = await player.loadChannel(channel);
  if (!ok) hideProgress();
  ui.setSelectedResolution('auto');
  const p = player.getPlayer();
  if (p) {
    ui.setResolutions(player.getResolutions());
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

function updateResolutionBadge(height, bandwidth) {
  const el = document.getElementById('resolution-badge');
  if (!el) return;
  const label = getResolutionLabel(height);
  const bw = bandwidth || player.getActiveBandwidth();
  el.textContent = label + formatBandwidth(bw);
  el.classList.remove('hidden');
}

let progressActive = false;

function showProgress(text) {
  const el = document.getElementById('progress-toast');
  if (!el) return;
  progressActive = true;
  el.classList.remove('hidden');
  document.getElementById('progress-text').textContent = text;
}

function updateProgressPercent(percent) {
  if (!progressActive) return;
  const el = document.getElementById('progress-text');
  if (el && typeof percent === 'number') {
    el.textContent = 'Reloading ' + percent + '%';
  }
}

function hideProgress() {
  progressActive = false;
  const el = document.getElementById('progress-toast');
  if (el) el.classList.add('hidden');
}

let lastBackTime = 0;

async function refreshChannelsInBackground() {
  const active = getActivePlaylist();
  if (!active || !active.url) return;
  try {
    const newChannels = await fetchFromPlaylistUrl(active.url);
    applyProxyOverrides(newChannels);
    saveSettings({ channels: newChannels, channelsFetched: new Date().toISOString() });
    sortChannels(newChannels);
    channels = newChannels;
    ui.refreshChannelList(channels);

  } catch (e) {
    console.warn('Background playlist refresh failed:', e.message);
  }
}

function registerTizenKeys() {
  if (!window.tizen || !window.tizen.tvinputdevice) return;
  const keys = [
    'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
    'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
    'MediaFastForward', 'MediaRewind', 'MediaTrackNext', 'MediaTrackPrevious',
    'ChannelUp', 'ChannelDown',
  ];
  for (const key of keys) {
    try { window.tizen.tvinputdevice.registerKey(key); } catch (e) { console.warn('Failed to register Tizen key:', key); }
  }
}

function handleRemoteAction(action, value) {
  if (action === 'back') {
    const now = Date.now();
    if (now - lastBackTime < 600) return;
    lastBackTime = now;
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
        showPlayer();
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
      default:
        break;
    }
    return;
  }

  if (ui.isSidebarOpen()) {
    const mode = ui.getSidebarMode();
    if (mode === 'groups') {
      switch (action) {
        case 'up':
          ui.navigateGroupUp();
          break;
        case 'down':
          ui.navigateGroupDown();
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
    selectedGroup = ui.getSelectedGroup();
    currentIndex = ui.getCurrentIndex();
    return;
  }

  switch (action) {
    case 'up':
    case 'channelUp':
    case 'prev': {
      const displayChannels = getDisplayChannels();
      const currentDisplayIdx = displayChannels.indexOf(channels[currentIndex]);
      const idx = currentDisplayIdx >= 0 ? currentDisplayIdx : 0;
      const prev = (idx - 1 + displayChannels.length) % displayChannels.length;
      const prevChannel = displayChannels[prev];
      
      if (pendingPreview && pendingPreview === prevChannel) {
        currentIndex = channels.indexOf(prevChannel);
        ui.selectChannel(currentIndex, true);
        ui.showChannelOsd(prevChannel);
        ui.hideChannelPreview();
        pendingPreview = null;
      } else {
        pendingPreview = prevChannel;
        ui.showChannelPreview(prevChannel, 'up');
      }
      break;
    }
    case 'down':
    case 'channelDown':
    case 'next': {
      const displayChannels = getDisplayChannels();
      const currentDisplayIdx = displayChannels.indexOf(channels[currentIndex]);
      const idx = currentDisplayIdx >= 0 ? currentDisplayIdx : 0;
      const next = (idx + 1) % displayChannels.length;
      const nextChannel = displayChannels[next];
      
      if (pendingPreview && pendingPreview === nextChannel) {
        currentIndex = channels.indexOf(nextChannel);
        ui.selectChannel(currentIndex, true);
        ui.showChannelOsd(nextChannel);
        ui.hideChannelPreview();
        pendingPreview = null;
      } else {
        pendingPreview = nextChannel;
        ui.showChannelPreview(nextChannel, 'down');
      }
      break;
    }
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
          if (window.tizen && window.tizen.application) {
            try { window.tizen.application.getCurrentApplication().exit(); } catch {}
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
      ui.toggleCurrentChannelProxy();
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
  ch.sort((a, b) => {
    if (!a || !b) return 0;
    const aHas = a.channelNumber != null && !isNaN(a.channelNumber);
    const bHas = b.channelNumber != null && !isNaN(b.channelNumber);
    if (aHas && bHas) return a.channelNumber - b.channelNumber;
    if (aHas) return -1;
    if (bHas) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });
}

function applyProxyOverrides(channels) {
  const overrides = getProxyOverrides();
  for (const ch of channels) {
    if (ch.url in overrides) {
      ch.useProxy = overrides[ch.url];
      if (ch.useProxy && !ch.proxyUrl) {
        ch.proxyUrl = window.location.origin + '/proxy/';
      }
    }
  }
}

export async function refreshChannels() {
  const active = getActivePlaylist();
  if (active && active.url) {
    try {
      const newChannels = await fetchFromPlaylistUrl(active.url);
      applyProxyOverrides(newChannels);
      saveSettings({ channels: newChannels, channelsFetched: new Date().toISOString() });
      sortChannels(newChannels);
      channels = newChannels;
      ui.refreshChannelList(channels);

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
