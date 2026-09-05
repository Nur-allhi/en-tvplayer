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

// BUG-013: URLs that crashed with a native TypeError inside Shaka (e.g. HLS
// streams with EXT-X-PROGRAM-DATE-TIME tags — upstream bug #5014, never
// fixed upstream). These channels are retried once with HLS program-date-time
// sync disabled, since v1.7.0 re-enabled PDT handling (BUG-010). Per-URL so
// every other channel always uses the full configuration.
const pdtFallbackUrls = new Set();

// BUG-014: URLs Shaka could not identify (error 4000 = UNABLE_TO_GUESS_
// MANIFEST_TYPE). The format is probed from the first bytes of the stream and
// cached per URL so the retry load passes the right hint to Shaka.
const sniffedMimeUrls = new Map();
const sniffTriedUrls = new Set();

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
      request.uris[0] = rewriteUrlThroughProxy(currentChannel, url);
    });
  }

  const settings = getSettings();
  const playerConfig = { ...config.player };
  if (settings.autoQuality === false) {
    playerConfig.abr = { ...config.player.abr, enabled: false };
  }
  if (currentChannel && pdtFallbackUrls.has(currentChannel.url)) {
    // BUG-013 fallback: skip HLS program-date-time sync for channels that
    // crashed inside Shaka, avoiding the un-fixed upstream null dereference.
    playerConfig.manifest = playerConfig.manifest ? { ...playerConfig.manifest } : {};
    playerConfig.manifest.hls = playerConfig.manifest.hls ? { ...playerConfig.manifest.hls } : {};
    playerConfig.manifest.hls.ignoreManifestProgramDateTime = true;
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

// Native JS crash thrown from inside Shaka (no shaka.util.Error code), e.g.
// "Cannot read properties of null (reading 'next')".
function isNativeLoadCrash(error) {
  if (!error) return false;
  if (typeof error.code === 'number') return false; // shaka.util.Error
  if (error instanceof TypeError) return true;
  const msg = error.message || '';
  return /Cannot read propert/.test(msg) && /reading /.test(msg);
}

// Routes a stream URL through the channel's proxy the same way Shaka's
// request filter does, so probing and playback hit the same endpoint.
function rewriteUrlThroughProxy(channel, url) {
  if (!channel || channel.useProxy !== true) return url;
  const rawProxy = channel.proxyUrl;
  if (!rawProxy) return url;
  let proxyUrl = rawProxy;
  if (window.location.protocol === 'https:' && proxyUrl.startsWith('http://')) {
    proxyUrl = window.location.origin + '/proxy/';
  }
  if (!url || !url.startsWith('http')) return url;
  if (url.startsWith(proxyUrl)) return url;
  return proxyUrl.replace(/\/+$/, '') + '/' + url;
}

// BUG-014: Shaka reports error 4000 when it cannot guess a stream's format
// from the URL (no extension) or the server's Content-Type. Probe the first
// bytes of the stream ourselves and return the format Shaka should use.
// Returns null when the format cannot be determined.
async function probeChannelFormat(channel) {
  if (!channel) return null;
  try {
    let targetUrl = rewriteUrlThroughProxy(channel, channel.url);
    if (!targetUrl) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const headers = {};
    if (channel.userAgent) headers['User-Agent'] = channel.userAgent;
    if (channel.customHeaders) {
      for (const [k, v] of Object.entries(channel.customHeaders)) {
        const lower = k.toLowerCase();
        if (lower === 'user-agent') headers['User-Agent'] = v;
        else if (lower === 'referer') headers['Referer'] = v;
        else if (lower === 'origin') headers['Origin'] = v;
        else headers[k] = v;
      }
    }

    const resp = await fetch(targetUrl, { headers, signal: controller.signal });
    if (!resp.ok) {
      clearTimeout(timer);
      return null;
    }
    if (!resp.body || typeof resp.body.getReader !== 'function') {
      clearTimeout(timer);
      return null;
    }

    const reader = resp.body.getReader();
    let bytes = new Uint8Array(0);
    const MAX = 65536;
    while (bytes.length < MAX) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const next = new Uint8Array(bytes.length + value.length);
        next.set(bytes);
        next.set(value, bytes.length);
        bytes = next;
      }
    }
    try { await reader.cancel(); } catch (e) {}
    clearTimeout(timer);
    if (bytes.length < 8) return null;

    // MP4: ftyp box at offset 4.
    const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (box === 'ftyp') return 'video/mp4';

    // Text-based manifests: HLS (#EXTM3U / #EXT-X-...) and DASH (<MPD).
    const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 8192)));
    const trimmed = head.trimStart();
    if (trimmed.startsWith('#EXTM3U') || head.includes('#EXT-X-')) {
      return 'application/vnd.apple.mpegurl'; // force Shaka's HLS parser
    }
    if (trimmed.startsWith('<MPD') || (trimmed.startsWith('<?xml') && head.includes('<MPD'))) {
      return 'application/dash+xml'; // force Shaka's DASH parser
    }

    // MPEG-TS: sync byte 0x47 repeating every 188 bytes.
    for (let start = 0; start < 4 && start + 564 < bytes.length; start++) {
      if (bytes[start] === 0x47 && bytes[start + 188] === 0x47 &&
          bytes[start + 376] === 0x47 && bytes[start + 564] === 0x47) {
        return 'video/mp2t';
      }
    }
    return null;
  } catch (e) {
    logEvent('WARN', 'Format probe failed: ' + (e && e.message ? e.message : e));
    return null;
  }
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
    // A probed format (BUG-014) takes priority over URL-pattern detection.
    // Look the probe up by clean channel URL: `url` may carry a `?_t` cache
    // buster (BUG-017) while the probe is stored under the original URL.
    const mimeType = sniffedMimeUrls.get(channel.url) || detectMimeType(url);
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

    // Shaka could not guess the stream format from the URL (error 4000).
    // Many IPTV servers hide the channel type behind tokenized links with no
    // file extension. Probe the first bytes and retry with the right hint.
    if (error && error.code === 4000 && currentChannel && !sniffTriedUrls.has(currentChannel.url)) {
      sniffTriedUrls.add(currentChannel.url);
      const crashedChannel = currentChannel;
      const tokenAtCatch = loadToken;
      showCustomMessage('Identifying channel format...');
      probeChannelFormat(crashedChannel).then((mime) => {
        if (tokenAtCatch !== loadToken) return; // user switched channels meanwhile
        if (!mime) {
          logEvent('WARN', 'Could not identify channel format: ' + crashedChannel.url.slice(0, 100));
          showError('This channel could not be identified. Try enabling Proxy in the menu, or try a different channel.');
          return;
        }
        sniffedMimeUrls.set(crashedChannel.url, mime);
        logEvent('INFO', 'Identified channel format: ' + mime + ' for ' + crashedChannel.url.slice(0, 80) + ' — retrying');
        loadChannel(crashedChannel);
      });
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

    // BUG-017: tokenized servers reject loads with 403/401 when the token
    // went stale between playlist fetch and segment fetch. Every loadChannel()
    // refetches the master playlist (fresh token), so retry twice first.
    if (error && error.code === 1001 && currentChannel && reconnectAttempts < 2) {
      const status = error.data && error.data[1];
      if (status === 403 || status === 401) {
        logEvent('WARN', 'Access denied at load (' + status + ') — retrying with fresh token');
        scheduleReconnect();
        return false;
      }
    }

    if (currentChannel && currentChannel.useProxy === false && proxySuggestionCallback) {
      proxySuggestionCallback(currentChannel);
    }

    if (isNativeLoadCrash(error) && currentChannel && !pdtFallbackUrls.has(currentChannel.url)) {
      // Retry once with HLS program-date-time sync disabled (BUG-013): some
      // HLS streams crash inside Shaka's PDT handling, which v1.7.0 enabled.
      pdtFallbackUrls.add(currentChannel.url);
      const crashedChannel = currentChannel;
      const tokenAtCatch = loadToken;
      logEvent('WARN', 'Native crash loading channel — retrying without PDT sync: ' +
          (crashedChannel.name || crashedChannel.url.slice(0, 80)));
      showCustomMessage('Retrying with compatibility mode...');
      setTimeout(() => { if (tokenAtCatch === loadToken) loadChannel(crashedChannel); }, 1200);
      return false;
    }

    if (isNativeLoadCrash(error)) {
      logEvent('ERROR', 'Channel failed to load (native crash): ' +
          (currentChannel ? currentChannel.name + ' | ' + currentChannel.url.slice(0, 100) : '?') +
          ' — ' + (error.message || ''));
      if (typeof console !== 'undefined') console.error('Channel load crashed inside Shaka:', error, error.stack);
      showError('This channel could not start — it uses a stream format this player could not handle. Try another channel or enable Proxy.');
      return false;
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

  // Native crash inside Shaka during playback — retry once with HLS PDT sync
  // disabled (BUG-013), unless we are still inside load() (its catch handles
  // that path).
  if (isNativeLoadCrash(error) && !loadingTimeout) {
    if (currentChannel && !pdtFallbackUrls.has(currentChannel.url)) {
      pdtFallbackUrls.add(currentChannel.url);
      logEvent('WARN', 'Native crash during playback — reloading without PDT sync: ' +
          (currentChannel.name || currentChannel.url.slice(0, 80)));
      showReloadingMessage();
      loadChannel(currentChannel);
      return;
    }
    logEvent('ERROR', 'Playback crashed (native): ' +
        (currentChannel ? currentChannel.name + ' | ' + currentChannel.url.slice(0, 100) : '?') +
        ' — ' + (error.message || ''));
    if (typeof console !== 'undefined') console.error('Shaka runtime crash:', error, error.stack);
    showError('This channel stopped unexpectedly — it uses a stream format this player could not handle. Try another channel or enable Proxy.');
    return;
  }

  // 403 (BAD_HTTP_STATUS, code 1001, status in data[1]) on a segment: retry
  // up to 3 times with 2s gap to get fresh ?m= tokens.
  if (error.code === 1001 && currentChannel) {
    const status = error.data && error.data[1];
    if (status === 403) {
      lastResortAttempts++;
      logEvent('WARN', '403 on segment — retry ' + lastResortAttempts + '/3');
      if (lastResortAttempts <= 3) {
        reconnectAttempts = Math.max(reconnectAttempts, 1);
        showReconnectMessage('Trying again (' + lastResortAttempts + '/3)...');
        setTimeout(() => {
          logEvent('INFO', '403 retry ' + lastResortAttempts + '/3 — reloading channel');
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
  if (error.code === 1001 && channelAdvanceCallback) {
    const status = error.data && error.data[1];
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
  // Shaka error codes below match shaka-player 5.x (see lib/util/error.js):
  //   1000 UNSUPPORTED_SCHEME (never transient)
  //   1001 BAD_HTTP_STATUS   (status is error.data[1])
  //   1002 HTTP_ERROR        (request failed for a non-server reason)
  //   1003 TIMEOUT           (no response at all)
  if (error.code === 1000) return false;
  // BAD_HTTP_STATUS — retry server failures and "no status", not client errors
  if (error.code === 1001) {
    const status = error.data && error.data[1];
    if (!status) return true;
    return status >= 500 || status === 429 || status === 408;
  }
  // HTTP_ERROR / TIMEOUT — always transient, retry
  if (error.code === 1002 || error.code === 1003) return true;
  // MediaSource operation errors — recover by reloading (destroys corrupted MediaSource)
  if (error.code === 3014 || error.code === 3015 || error.code === 3016) return true;
  // BUG-017: live/tokenized servers (e.g. kliv) serve stale segments that fail
  // to transmux (3018), and Shaka then disables the only variant which
  // surfaces as 4032 CONTENT_UNSUPPORTED_BY_BROWSER. A fresh load refetches
  // the master playlist (new token) and clears the disabled state.
  if (error.code === 3018 || error.code === 4032) return true;
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

function showCustomMessage(message) {
  const el = document.getElementById('error');
  if (el) {
    el.textContent = message;
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
    1000: 'This channel link uses a type your TV cannot open.',
    1001: 'The channel server rejected the request. It may be blocking this app right now.',
    1002: 'Could not connect to the channel stream. The server may be down or blocking the app right now.',
    1003: 'The channel took too long to respond. It may be slow or turned off right now.',
    1004: 'This channel link is not valid.',
    1005: 'This channel link is not valid.',
    7000: 'Channel loading was interrupted.',
    2000: 'This channel contains text data the app could not read.',
    2001: 'This channel contains text data the app could not read.',
    2002: 'This channel contains text data the app could not read.',
    2003: 'This channel contains text with an unknown encoding.',
    2004: 'This channel contains text data that could not be decoded.',
    2005: 'This channel contains data that could not be read.',
    2006: 'This channel contains captions the app could not read.',
    6000: 'This channel uses a protection type that is not recognized.',
    6001: 'This channel is protected and your TV cannot play protected channels.',
    6002: 'Could not set up playback for this channel. Please restart the app and try again.',
    6007: 'This channel is protected but the key could not be obtained.',
    6020: 'This channel is protected and your TV does not support this type of protection.',
    3000: 'This channel could not play on your TV.',
    3001: 'This channel uses stream values your TV could not process.',
    3002: 'This channel could not play on your TV.',
    3003: 'This channel could not play on your TV.',
    3018: 'The live stream broke up. Trying again — if it persists, try another channel.',
    4000: 'This channel could not be identified. Try enabling Proxy in the menu, or try a different channel.',
    4032: 'This channel stopped playing in a format your TV accepts. Trying again — if it persists, try another channel.',
  };

  // BAD_HTTP_STATUS (1001): the real HTTP status is in error.data[1].
  if (code === 1001) {
    const status = error.data && error.data[1];
    if (status === 403) return 'This channel is not allowed to play. You may need a subscription or different access.';
    if (status === 401) return 'This channel requires a login or key to play.';
    if (status === 404) return 'This channel was not found. The link may have changed.';
    if (typeof status === 'number' && status >= 500) return 'The channel server is having problems. Please try again later.';
    if (typeof status === 'number' && status) return 'Channel returned an error (code ' + status + '). Please try again.';
    if (status) return 'Could not load this channel. Please try again.';
    return 'The channel server rejected the request. It may be blocking this app right now.';
  }

  if (messages[code]) {
    return messages[code];
  }

  if (error.message) {
    return error.message.substring(0, 100);
  }

  return 'Something went wrong (error ' + code + '). Please try another channel or restart the app.';
}
