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
let stalledTimer = null;

// Detect MIME type from URL pattern for direct stream URLs.
// IPTV playlists often contain raw .ts or .mp4 URLs without manifest wrappers.
// Shaka Player needs a MIME type hint to play these correctly on Samsung Tizen.
function detectMimeType(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (path.endsWith('.m3u8')) return null; // HLS — Shaka detects automatically
    if (path.endsWith('.mpd')) return null; // DASH — Shaka detects automatically
    if (path.endsWith('.ts')) return 'video/mp2t';
    if (path.endsWith('.mp4')) return 'video/mp4';
    if (path.endsWith('.mkv')) return 'video/x-matroska';
    if (path.endsWith('.flv')) return 'video/x-flv';
    // Direct numeric or query-only paths (e.g. /1234 or /stream?id=123)
    // are almost always MPEG-TS streams in IPTV playlists.
    const segs = path.split('/').filter(Boolean);
    if (segs.length > 0 && /^\d+$/.test(segs[segs.length - 1])) {
      return 'video/mp2t';
    }
  } catch {}
  return null; // let Shaka auto-detect
}

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
  videoEl.removeEventListener('error', onVideoError);
  videoEl.removeEventListener('stalled', onVideoStalled);
  videoEl.removeEventListener('waiting', onVideoWaiting);
  videoEl.addEventListener('progress', notifyBufferingProgress);
  videoEl.addEventListener('timeupdate', notifyBufferingProgress);
  videoEl.addEventListener('play', onPlayEvent);
  videoEl.addEventListener('pause', onPauseEvent);
  videoEl.addEventListener('error', onVideoError);
  videoEl.addEventListener('stalled', onVideoStalled);
  videoEl.addEventListener('waiting', onVideoWaiting);

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

let videoErrorCount = 0;
let lastVideoErrorTime = 0;

function onVideoError() {
  if (!videoElement) return;
  const err = videoElement.error;
  if (!err) return;
  const now = Date.now();
  // Debounce: ignore duplicate errors within 3s
  if (now - lastVideoErrorTime < 3000) return;
  lastVideoErrorTime = now;
  videoErrorCount++;
  const mediaErrorMessages = {
    1: 'Video playback was aborted',
    2: 'A network error occurred while loading the video',
    3: 'The video could not be decoded — unsupported codec or corrupt stream',
    4: 'Video source not supported on this device — try a different quality or proxy',
  };
  const msg = mediaErrorMessages[err.code] || ('Video error (code ' + err.code + ')');
  logEvent('ERROR', 'Video element error: ' + msg + ' (code=' + err.code + ', mediaErr=' + (err.message || '') + ')');
  if (videoErrorCount >= 2 && currentChannel) {
    // 2+ native errors in a row — this stream format is likely unsupported
    logEvent('ERROR', 'Channel appears unsupported on this device: ' + (currentChannel.name || currentChannel.url.slice(0, 60)));
    showError('This channel could not play. Try turning on Proxy in the menu, or pick a different channel.');
    videoErrorCount = 0;
  }
}

function onVideoStalled() {
  if (!videoElement || videoElement.paused) return;
  clearTimeout(stalledTimer);
  stalledTimer = setTimeout(() => {
    if (!videoElement || videoElement.paused) return;
    const currentTime = videoElement.currentTime;
    if (videoElement.readyState < 3 && currentTime === (videoElement._lastStallTime || 0)) {
      logEvent('WARN', 'Video stalled for 10s — may not be playable on this device');
      showError('This channel is taking too long to load. Please wait or try a different channel.');
    }
    videoElement._lastStallTime = currentTime;
  }, 10000);
}

function onVideoWaiting() {
  // Clear stalled timer since waiting is normal during buffering
  clearTimeout(stalledTimer);
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
    showError('This channel is protected and cannot play here. Try a different channel.');
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

    // Timeout: if player.load hangs for 15s, show feedback and destroy
    // the player so the pending load() promise rejects.
    loadingTimeout = setTimeout(() => {
      logEvent('WARN', 'Load timed out after 15s — stream may be unsupported');
      showError('This channel is not responding. It may be turned off right now.');
      if (player) player.destroy().catch(() => {});
      if (videoElement) {
        videoElement.src = '';
        videoElement.load();
      }
    }, 15000);

    // Detect MIME type for direct TS/MP4 stream URLs (common in IPTV playlists).
    // Without this hint, Shaka may fail to identify the format and show a black screen.
    const mimeType = detectMimeType(url);
    if (mimeType) {
      logEvent('INFO', 'Detected MIME type: ' + mimeType + ' for ' + url.slice(0, 80));
      await player.load(url, undefined, mimeType);
    } else {
      await player.load(url);
    }
    clearTimeout(loadingTimeout);
    loadingTimeout = null;

    if (myToken !== loadToken) return false;

    showLoading(false);
    reconnectAttempts = 0;
    consecutiveErrors = 0;
    videoErrorCount = 0;
    startStallWatchdog();
    logEvent('INFO', 'Loaded: ' + (channel.name || channel.url.slice(0, 60)));
    return true;
  } catch (error) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
    if (myToken !== loadToken) return false;

    showLoading(false);
    videoErrorCount = 0;

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
      if (reconnectAttempts < 3) {
        scheduleReconnect();
      } else {
        showError('Could not load this channel after several tries. It may be turned off or not available on your TV.');
        logEvent('ERROR', 'Reconnect limit reached — ' + (channel.name || channel.url.slice(0, 60)));
      }
      return false;
    }

    if (isRecoverable(error)) {
      logEvent('WARN', 'Load failed (recoverable ' + error.code + ')');
      if (reconnectAttempts < 3) {
        scheduleReconnect();
      } else {
        showError(getErrorMessage(error) + ' — channel may be turned off');
      }
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
  clearTimeout(stalledTimer);
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
        showReconnectMessage('Trying again (' + lastResortAttempts + '/3)...');
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
      showReloadingMessage();
      loadChannel(currentChannel);
      return;
    }
    scheduleReconnect();
    return;
  }

  logEvent('ERROR', 'Unrecoverable error ' + error.code + ' (' + (currentChannel && currentChannel.name ? currentChannel.name : 'unknown') + ') — ' + getErrorMessage(error));
  showError(getErrorMessage(error));

  // Auto-advance to next channel after 3 failed 403 retries
  if (error.code === 1002 && channelAdvanceCallback) {
    const status = error.data && error.data[0];
    if (status === 403 && lastResortAttempts > 3) {
      advancePending = true;
      logEvent('INFO', '3 retries exhausted — advancing to next channel');
      showError('This channel link has expired. Moving to the next channel...');
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
    el.textContent = 'Connection lost. Trying again... (' + attempt + ')';
    el.classList.remove('hidden');
  }
}

function showReloadingMessage() {
  const el = document.getElementById('error');
  if (el) {
    el.textContent = 'Reloading channel...';
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
        showReloadingMessage();
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
  if (!error) return 'Something went wrong. Please try another channel.';

  const code = error.code;

  // Simple, non-technical messages users can understand and report back
  const messages = {
    1000: 'Could not connect to the channel. Please check your internet connection and try again.',
    1001: 'The channel took too long to respond. It may be slow or turned off right now.',
    7000: 'Channel loading was interrupted.',
    2000: 'This channel could not play on your TV. It may use a format your TV does not support.',
    2001: 'This channel could not play. The video type is not supported on your TV.',
    2002: 'This channel cannot play on your TV. The video format is not supported.',
    2003: 'Could not recognize this channel format. Try turning on Proxy in the menu.',
    2004: 'This channel denied access. You may need permission to watch it.',
    2005: 'This channel is protected and requires a special key to play.',
    2006: 'This channel is protected but the key could not be obtained.',
    6000: 'This channel uses a protection type that is not recognized.',
    6001: 'This channel is protected and your TV cannot play protected channels.',
    6002: 'Could not set up playback for this channel. Please restart the app and try again.',
    6007: 'This channel is protected but the key could not be obtained.',
    6020: 'This channel is protected and your TV does not support this type of protection.',
    3000: 'Something went wrong while trying to play this channel.',
    3001: 'This channel format is not supported. It may be an outdated or uncommon format.',
    3002: 'This channel was not found. The link may have changed or expired.',
    3003: 'Could not load this channel. The source may be offline.',
    4000: 'Something went wrong while changing the playing position.',
  };

  if (code === 1002) {
    const status = error.data && error.data[0];
    if (status === 403) return 'This channel is not allowed to play. You may need a subscription or different access.';
    if (status === 401) return 'This channel requires a login or key to play.';
    if (status === 404) return 'This channel was not found. The link may have changed.';
    if (typeof status === 'number' && status >= 500) return 'The channel server is having problems. Please try again later.';
    if (typeof status === 'number' && status) return 'Channel returned an error (code ' + status + '). Please try again.';
    if (status) return 'Could not load this channel. Please try again.';
    return 'Lost connection to the channel. Please check your internet and try again.';
  }
  if (code === 1004) {
    return 'Could not load the channel list from the server.';
  }
  if (code === 1005) {
    return 'The channel server took too long to respond.';
  }

  if (messages[code]) {
    return messages[code];
  }

  if (error.message) {
    return error.message.substring(0, 100);
  }

  return 'Something went wrong (error ' + code + '). Please try another channel or restart the app.';
}
