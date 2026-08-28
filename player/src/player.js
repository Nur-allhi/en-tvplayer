import shaka from 'shaka-player';
import config, { getSettings } from './config.js';

function logEvent(level, message) {
  try {
    fetch('/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message }),
    }).catch(() => {});
  } catch (e) {}
}

let player = null;
let videoElement = null;
let bufferingCallback = null;
let trackCallback = null;
let channelAdvanceCallback = null;
let proxySuggestionCallback = null;
let isBuffering = false;
let currentChannel = null;
let loadToken = 0;
let reconnectTimer = null;
let reconnectPending = false;
let reconnectAttempts = 0;
let consecutiveErrors = 0;
let stallWatchdogTimer = null;
let lastStallTime = 0;
let lastStallCheck = 0;
let lastResortAttempts = 0;
let advancePending = false;

let loadingTimeout = null;

export async function initPlayer(videoEl) {
  videoElement = videoEl;

  shaka.polyfill.installAll();

  if (!shaka.Player.isBrowserSupported()) {
    console.error('Shaka Player not supported in this browser');
    return false;
  }

  player = new shaka.Player();

  const networkingEngine = player.getNetworkingEngine();
  if (networkingEngine) {
    networkingEngine.registerRequestFilter((type, request) => {
      const url = request.uris && request.uris[0];
      if (currentChannel) {
        if (currentChannel.userAgent) {
          request.headers['User-Agent'] = currentChannel.userAgent;
        }
        if (currentChannel.customHeaders) {
          for (const [k, v] of Object.entries(currentChannel.customHeaders)) {
            const lower = k.toLowerCase();
            if (['user-agent', 'referer', 'origin'].includes(lower)) {
              const canon = lower === 'user-agent' ? 'User-Agent' : lower === 'referer' ? 'Referer' : 'Origin';
              request.headers[canon] = v;
            }
          }
        }
      }
      if (!currentChannel || currentChannel.useProxy !== true) {
        return;
      }
      let proxyUrl = currentChannel.proxyUrl;
      if (window.location.protocol === 'https:' && proxyUrl.startsWith('http://')) {
        proxyUrl = window.location.origin + '/proxy/';
      }
      if (!url || !url.startsWith('http')) return;
      if (url.startsWith(proxyUrl)) return;
      request.uris[0] = proxyUrl.replace(/\/+$/, '') + '/' + url;
    });
  }

  const settings = getSettings();
  const playerConfig = { ...config.player };
  if (settings.autoQuality === false) {
    playerConfig.abr = { ...config.player.abr, enabled: false };
  }
  player.configure(playerConfig);

  player.addEventListener('error', (event) => {
    handlePlayerError(event.detail);
  });

  player.addEventListener('buffering', (event) => {
    isBuffering = event.buffering;
    showLoading(event.buffering);
    if (bufferingCallback) bufferingCallback(event.buffering);
  });

  player.addEventListener('variantchanged', (event) => {
    const newTrack = event.detail && event.detail.newTrack;
    if (trackCallback && newTrack) {
      trackCallback({ height: newTrack.height, bandwidth: newTrack.bandwidth });
    }
  });

  videoEl.removeEventListener('progress', notifyBufferingProgress);
  videoEl.removeEventListener('timeupdate', notifyBufferingProgress);
  videoEl.removeEventListener('play', onPlayEvent);
  videoEl.removeEventListener('pause', onPauseEvent);
  videoEl.addEventListener('progress', notifyBufferingProgress);
  videoEl.addEventListener('timeupdate', notifyBufferingProgress);
  videoEl.addEventListener('play', onPlayEvent);
  videoEl.addEventListener('pause', onPauseEvent);

  await player.attach(videoEl).catch((e) => console.error('Player attach failed:', e));
  return true;
}

function notifyBufferingProgress() {
  if (isBuffering && bufferingCallback) {
    bufferingCallback(true, getBufferingPercent());
  }
}

function onPlayEvent() {
  showPlayState(false);
}

function onPauseEvent() {
  showPlayState(true);
}

export function onBuffering(callback) {
  bufferingCallback = callback;
}

export function onTrackChange(callback) {
  trackCallback = callback;
}

export function onChannelAdvance(callback) {
  channelAdvanceCallback = callback;
}

export function onProxySuggestion(callback) {
  proxySuggestionCallback = callback;
}

export function getActiveTrack() {
  if (!player) return null;
  const tracks = player.getVariantTracks();
  return tracks.find((t) => t.active) || null;
}

export function getActiveHeight() {
  const t = getActiveTrack();
  return t ? t.height : null;
}

export function getActiveBandwidth() {
  const t = getActiveTrack();
  return t ? t.bandwidth : null;
}

export function isEmeSupported() {
  const hasApi = typeof navigator !== 'undefined' && typeof navigator.requestMediaKeySystemAccess === 'function';
  const hasMediaKeys = typeof window !== 'undefined' && 'MediaKeys' in window;
  const ok = hasApi && hasMediaKeys;

  return ok;
}

export async function loadChannel(channel) {
  if (!channel) return false;

  if (channel.drm && !isEmeSupported()) {
    logEvent('ERROR', 'DRM not available — EME (Encrypted Media Extensions) is not supported in this browser/context');
    showError('DRM not available — play this on the actual TV, or try Chrome/Edge');
    return false;
  }

  const myToken = ++loadToken;
  currentChannel = channel;

  clearTimeout(reconnectTimer);
  clearTimeout(loadingTimeout);
  reconnectPending = false;
  stopStallWatchdog();
  hideError();
  showLoading(true);
  advancePending = false;
  lastResortAttempts = 0;

  let url = channel.url;
  if (reconnectAttempts > 0) {
    const sep = url.indexOf('?') >= 0 ? '&' : '?';
    url += sep + '_t=' + Date.now();
  }

  try {
    // Always destroy and recreate the player on every channel switch.
    // On Tizen, Shaka's unload/load can hang forever when stuck on a failed
    // network request. Destroy+recreate guarantees a clean slate.
    const el = videoElement;
    await destroyPlayer(el);
    if (myToken !== loadToken) return false;

    if (el) {
      const ok = await initPlayer(el);
      if (!ok) return false;
    }
    currentChannel = channel;
    if (myToken !== loadToken) return false;

    if (channel.drm) {
      player.configure({
        drm: {
          clearKeys: {
            [channel.drm.keyId]: channel.drm.key,
          },
        },
      });
    } else {
      player.configure({ drm: { clearKeys: {} } });
    }

    // Timeout: if player.load hangs for 30s, destroy the player so the
    // pending load() promise rejects, unblocking the catch path below.
    loadingTimeout = setTimeout(() => {
      logEvent('WARN', 'Load timed out — destroying stuck player');
      if (player) player.destroy().catch(() => {});
      if (videoElement) {
        videoElement.src = '';
        videoElement.load();
      }
    }, 30000);

    await player.load(url);
    clearTimeout(loadingTimeout);
    loadingTimeout = null;

    if (myToken !== loadToken) return false;

    showLoading(false);
    reconnectAttempts = 0;
    consecutiveErrors = 0;
    startStallWatchdog();
    logEvent('INFO', 'Loaded: ' + (channel.name || channel.url.slice(0, 60)));
    return true;
  } catch (error) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
    if (myToken !== loadToken) return false;

    showLoading(false);

    if (error && error.code === 7000) return false;

    // After a timeout, the player was destroyed above. Recreate it so the
    // next channel switch works.
    if (error && (error.message === 'Load timed out' || error.name === 'DestroyedError')) {
      logEvent('WARN', 'Load abandoned — recreating player for next attempt');
      const el = videoElement;
      await destroyPlayer(el);
      if (el && myToken === loadToken) {
        await initPlayer(el);
      }
      scheduleReconnect();
      return false;
    }

    if (isRecoverable(error)) {
      logEvent('WARN', 'Load failed (recoverable ' + error.code + ')');
      scheduleReconnect();
      return false;
    }

    if (currentChannel && currentChannel.useProxy === false && proxySuggestionCallback) {
      proxySuggestionCallback(currentChannel);
    }
    logEvent('ERROR', 'Failed to load — ' + getErrorMessage(error));
    showError(getErrorMessage(error));
    return false;
  }
}

async function destroyPlayer(keepElement) {
  stopStallWatchdog();
  clearTimeout(reconnectTimer);
  clearTimeout(loadingTimeout);
  reconnectPending = false;
  if (player) {
    try { await player.destroy(); } catch {}
    player = null;
  }
  if (videoElement) {
    videoElement.src = '';
    videoElement.load();
  }
  currentChannel = null;
  isBuffering = false;
  if (!keepElement) {
    videoElement = null;
  }
}

function handlePlayerError(error) {
  if (!error) return;

  // Ignore interruptions from switching channels
  if (error.code === 7000) return;

  console.error('Shaka error:', error);

  // Suppress errors while auto-advance is pending
  if (advancePending) return;

  consecutiveErrors++;

  // 403 on segment: retry up to 3 times with 2s gap to get fresh ?m= tokens
  if (error.code === 1002 && currentChannel) {
    const status = error.data && error.data[0];
    if (status === 403) {
      lastResortAttempts++;
      logEvent('WARN', '403 on segment — retry ' + lastResortAttempts + '/3');
      if (lastResortAttempts <= 3) {
        reconnectAttempts = Math.max(reconnectAttempts, 1);
        showReconnectMessage('Refreshing session (' + lastResortAttempts + '/3)...');
        setTimeout(() => {
          logEvent('INFO', '403 retry ' + lastResortAttempts + '/3 — reloading MPD');
          loadChannel(currentChannel);
        }, 2000);
        return;
      }
    }
  }

  if (isRecoverable(error)) {
    // After 3 consecutive errors, force a hard reload (cache-bust + fresh edge)
    if (consecutiveErrors >= 3) {
      consecutiveErrors = 0;
      showReconnectMessage('reloading');
      loadChannel(currentChannel);
      return;
    }
    scheduleReconnect();
    return;
  }

  logEvent('ERROR', 'Unrecoverable error ' + error.code + ' — ' + getErrorMessage(error));
  showError(getErrorMessage(error));

  // Auto-advance to next channel after 3 failed 403 retries
  if (error.code === 1002 && channelAdvanceCallback) {
    const status = error.data && error.data[0];
    if (status === 403 && lastResortAttempts > 3) {
      advancePending = true;
      logEvent('INFO', '3 retries exhausted — advancing to next channel');
      showError('Stream expired \u2014 advancing to next channel...');
      setTimeout(() => {
        advancePending = false;
        logEvent('INFO', 'Advancing channel');
        channelAdvanceCallback();
      }, 4000);
    }
  }
}

function isRecoverable(error) {
  if (!error) return false;
  // Network request errors (timeout / offline) — always retry
  if (error.code === 1000 || error.code === 1001) return true;
  // HTTP_ERROR on segment fetch — retry server failures, timeouts, and 0 (no response)
  if (error.code === 1002) {
    const status = error.data && error.data[0];
    if (!status) return true;
    return status >= 500 || status === 429;
  }
  // Manifest HTTP error — only retry transient server failures, same as HTTP_ERROR
  if (error.code === 1004) {
    const status = error.data && error.data[0];
    if (!status) return true;
    return status >= 500 || status === 429;
  }
  // Manifest request timeout — always retry (no response at all)
  if (error.code === 1005) return true;
  // MediaSource operation errors — recover by reloading (destroys corrupted MediaSource)
  if (error.code === 3014 || error.code === 3015 || error.code === 3016) return true;
  return false;
}

function scheduleReconnect() {
  if (reconnectPending || !currentChannel) return;
  reconnectPending = true;
  reconnectAttempts++;
  logEvent('WARN', 'Reconnecting (attempt ' + reconnectAttempts + ')');
  // Live recovery: fast initial retry, cap at 10s
  const delay = Math.min(1000 * reconnectAttempts, 10000);
  showReconnectMessage(String(reconnectAttempts));

  reconnectTimer = setTimeout(() => {
    reconnectPending = false;
    if (currentChannel) {
      loadChannel(currentChannel);
    }
  }, delay);
}

function showReconnectMessage(attempt) {
  const el = document.getElementById('error');
  if (el) {
    el.textContent = 'Connection lost. Reconnecting\u2026 (attempt ' + attempt + ')';
    el.classList.remove('hidden');
  }
}

function startStallWatchdog() {
  stopStallWatchdog();
  lastStallTime = videoElement ? videoElement.currentTime : 0;
  lastStallCheck = Date.now();
  stallWatchdogTimer = setInterval(() => {
    if (!videoElement || videoElement.paused) return;
    const now = videoElement.currentTime;
    if (now === lastStallTime && Date.now() - lastStallCheck > 15000) {
      consecutiveErrors++;
      logEvent('WARN', 'Stall detected (no progress for 15s)');
      if (consecutiveErrors >= 3) {
        consecutiveErrors = 0;
        logEvent('INFO', '3 stalls — hard reloading channel');
        showReconnectMessage('reloading');
        loadChannel(currentChannel);
      } else {
        scheduleReconnect();
      }
      return;
    }
    if (now !== lastStallTime) {
      lastStallTime = now;
      lastStallCheck = Date.now();
    }
  }, 2000);
}

function stopStallWatchdog() {
  if (stallWatchdogTimer) {
    clearInterval(stallWatchdogTimer);
    stallWatchdogTimer = null;
  }
}

// Force-reload the current channel (e.g. from R key or remote)
export function setAutoQuality(enabled) {
  if (!player) return;
  player.configure({ abr: { enabled } });
}

export function reloadChannel() {
  if (!currentChannel) return;
  consecutiveErrors = 0;
  advancePending = false;
  lastResortAttempts = 0;
  clearTimeout(reconnectTimer);
  reconnectPending = false;
  loadChannel(currentChannel);
}

export function stop() {
  destroyPlayer().catch(() => {});
  showLoading(false);
  hideError();
}

export function togglePlay() {
  if (!videoElement) return;

  if (videoElement.paused) {
    videoElement.play();
  } else {
    videoElement.pause();
  }
}

export function getPlayer() {
  return player;
}

export function getBufferingPercent() {
  if (!videoElement) return 0;
  const buffered = videoElement.buffered;
  let end = 0;
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= videoElement.currentTime &&
        videoElement.currentTime <= buffered.end(i)) {
      end = buffered.end(i);
    }
  }
  const ahead = Math.max(0, end - videoElement.currentTime);
  return Math.min(100, Math.round((ahead / 20) * 100));
}

export function getResolutions() {
  if (!player) return [];
  const tracks = player.getVariantTracks();
  const heights = [...new Set(tracks.map((t) => t.height))]
    .filter(Boolean)
    .sort((a, b) => a - b);
  return heights;
}

export function selectResolution(height) {
  if (!player) return;

  if (height == null) {
    player.configure({ abr: { enabled: true } });
    return;
  }

  const tracks = player.getVariantTracks().filter((t) => t.height === height);
  if (tracks.length) {
    player.configure({ abr: { enabled: false } });
    player.selectVariantTrack(tracks[0], true);
  }
}

export function getVideoElement() {
  return videoElement;
}

function showLoading(show) {
  const el = document.getElementById('loading');
  if (el) {
    el.classList.toggle('hidden', !show);
  }
}

function showPlayState(paused) {
  const el = document.getElementById('play-state');
  if (el) {
    el.classList.toggle('hidden', !paused);
  }
}

function showError(message) {
  const el = document.getElementById('error');
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
  }
}

function hideError() {
  const el = document.getElementById('error');
  if (el) {
    el.classList.add('hidden');
  }
}

function getErrorMessage(error) {
  if (!error) return 'Unknown error';

  // Shaka error codes
  const code = error.code;
  const severity = error.severity;

  // Common error messages
  const messages = {
    1000: 'Network error',
    1001: 'Network timeout',
    7000: 'Loading interrupted',
    2000: 'Media error',
    2001: 'Media decoding error',
    2002: 'Media not supported',
    2003: 'Source not found',
    2004: 'Source Access error',
    2005: 'DRM error',
     2006: 'DRM license request failed',
     6000: 'DRM not recognized (no usable key system in manifest)',
     6001: 'DRM key system not supported on this device',
     6002: 'DRM CDM failed to initialize',
     6007: 'DRM license request failed',
     6020: 'DRM not supported (MISSING_EME_SUPPORT) — browser does not support ClearKey DRM',
    3000: 'Player error',
    3001: 'Invalid stream',
    3002: 'Stream not found',
    3003: 'Could not load manifest',
    4000: 'Seek error',
  };

  if (code === 1002) {
    const status = error.data && error.data[0];
    if (status === 403) return 'Stream blocked (403 Forbidden) \u2014 the source rejected the request';
    if (status === 401) return 'Stream blocked (401 Unauthorized)';
    if (status === 404) return 'Stream not found (404)';
    if (typeof status === 'number' && status) return 'Stream error (HTTP ' + status + ')';
    if (status) return 'Stream error \u2014 unexpected response';
    return 'Network connection lost';
  }
  if (code === 1004) {
    return 'Manifest could not be loaded';
  }
  if (code === 1005) {
    return 'Manifest request timed out';
  }

  if (messages[code]) {
    return messages[code];
  }

  if (error.message) {
    return error.message.substring(0, 100);
  }

  return 'Playback error (' + code + ')';
}
