import shaka from 'shaka-player';
import config, { getSettings } from './config.js';
import { withAuthQuery, redactUrl } from './lib/url.js';
import {
  tuneCountersReset,
  isStalePlayerEvent,
  shouldIgnoreVideoError,
  hardReloadDecision,
  shouldResumePlayback,
  isNetworkActive,
  stallPatienceExceeded,
} from './logic.js';
import * as avplay from './avplay.js';
import { state } from './player/state.js';
import { planRecovery, httpStatusOf } from './player/recovery.js';

// App event log (console only; the dev log endpoint was removed with the proxy).
// Stream tokens (?token=…) are scrubbed: users paste inspector logs publicly.
function logEvent(level, message) {
  try {
    if (typeof console !== 'undefined' && console.debug) {
      const safe = typeof message === 'string' ? message.replace(/(https?:\/\/[^\s'"]+?)[?#][^\s'"]*/g, '$1') : message;
      console.debug('[app][' + level + ']', safe);
    }
  } catch {}
}

// All mutable engine state lives in one shared object (T-129). Every slice of
// the upcoming player/ split imports this same reference — see docs/MIGRATION.md
// Risk C for what happens if they each keep their own copy.

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

// Desktop test relay (branch-only, never shipped): prefix a channel URL so
// it loads through the local proxy (CORS + Origin/Referer/UA fix).
function proxyBase() {
  try {
    return (getSettings().proxyUrl || 'https://localhost:5001').replace(/\/+$/, '');
  } catch {
    return 'https://localhost:5001';
  }
}

function toProxied(url) {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  const base = proxyBase();
  if (url.startsWith(base + '/')) return url;
  return base + '/' + url;
}

function isProxyEnabledFor(url) {
  try {
    return !!(getSettings().proxyChannels || {})[url];
  } catch {
    return false;
  }
}

export async function initPlayer(videoEl) {
  state.videoElement = videoEl;
  // #16: generation guard — a previous instance whose destroy() hung can
  // still fire events after a channel switch; those must not touch the new tune.
  const gen = state.loadToken;

  shaka.polyfill.installAll();

  if (!shaka.Player.isBrowserSupported()) {
    console.error('Shaka Player not supported in this browser');
    return false;
  }

  state.player = new shaka.Player();

  const networkingEngine = state.player.getNetworkingEngine();
  if (networkingEngine) {
    // Track Shaka request activity for the load watchdog below.
    networkingEngine.registerRequestFilter((type, request) => {
      try {
        state.lastShakaReq =
          't' + type + ' ' + (request.uris && request.uris[0] ? redactUrl(request.uris[0]).slice(-55) : '?');
        state.lastShakaActivity = Date.now();
      } catch {}
    });
    networkingEngine.registerResponseFilter((type, response) => {
      try {
        state.lastShakaResp = 't' + type + ' ' + (response.uri ? redactUrl(response.uri).slice(-40) : '?');
        state.lastShakaActivity = Date.now();
      } catch {}
    });
    networkingEngine.registerRequestFilter((type, request) => {
      if (state.currentChannel) {
        if (state.currentChannel.userAgent) {
          request.headers['User-Agent'] = state.currentChannel.userAgent;
        }
        if (state.currentChannel.customHeaders) {
          // T-033: forward ALL per-channel headers (KODIPROP stream_headers,
          // EXTHTTP, pipe suffix) to the Shaka engine, not just UA/Referer.
          for (const [k, v] of Object.entries(state.currentChannel.customHeaders)) {
            const lower = k.toLowerCase();
            if (lower === 'user-agent') request.headers['User-Agent'] = v;
            else if (lower === 'referer') request.headers['Referer'] = v;
            else if (lower === 'origin') request.headers['Origin'] = v;
            else request.headers[k] = v;
          }
        }
        // Cookie-auth tokens can't be sent by browsers (forbidden header),
        // so they ride on the query string instead (see channel.authQuery).
        // Applied per request: DASH segment URLs resolve relative to the
        // manifest and drop its query, and HLS variants rotate tokens.
        if (state.currentChannel.authQuery && request.uris && request.uris[0]) {
          request.uris[0] = withAuthQuery(request.uris[0], state.currentChannel.authQuery);
        }
        // Desktop test relay: route this channel's manifest + segments via proxy.
        if (state.currentChannel.useProxy && request.uris && request.uris[0]) {
          request.uris[0] = toProxied(request.uris[0]);
        }
      }
    });
  }

  const settings = getSettings();
  const playerConfig = { ...config.player };
  if (settings.autoQuality === false) {
    playerConfig.abr = { ...config.player.abr, enabled: false };
  }
  if (state.currentChannel && state.pdtFallbackUrls.has(state.currentChannel.url)) {
    // BUG-013 fallback: skip HLS program-date-time sync for channels that
    // crashed inside Shaka, avoiding the un-fixed upstream null dereference.
    playerConfig.manifest = playerConfig.manifest ? { ...playerConfig.manifest } : {};
    playerConfig.manifest.hls = playerConfig.manifest.hls ? { ...playerConfig.manifest.hls } : {};
    playerConfig.manifest.hls.ignoreManifestProgramDateTime = true;
  }
  state.player.configure(playerConfig);

  state.player.addEventListener('error', (event) => {
    if (isStalePlayerEvent(gen, state.loadToken)) return;
    handlePlayerError(event.detail);
  });

  state.player.addEventListener('buffering', (event) => {
    if (isStalePlayerEvent(gen, state.loadToken)) return;
    state.isBuffering = event.buffering;
    if (state.initialLoadPending) return;
    showLoading(event.buffering);
    if (state.bufferingCallback) state.bufferingCallback(event.buffering);
  });

  state.player.addEventListener('variantchanged', (event) => {
    if (isStalePlayerEvent(gen, state.loadToken)) return;
    const newTrack = event.detail && event.detail.newTrack;
    if (state.trackCallback && newTrack) {
      state.trackCallback({ height: newTrack.height, bandwidth: newTrack.bandwidth });
    }
  });

  // BUG-019: ABR switches fire 'adaptation', not 'variantchanged' — without
  // this the badge freezes on the initial (optimistic) pick and lies.
  state.player.addEventListener('adaptation', () => {
    if (isStalePlayerEvent(gen, state.loadToken)) return;
    state.lastAdaptationAt = Date.now();
    const active = getActiveTrack();
    if (state.trackCallback && active) {
      state.trackCallback({ height: active.height, bandwidth: active.bandwidth });
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

  // attach() has no internal timeout: on Tizen it can wedge forever when a
  // previous teardown is still releasing the element (typical fast-switch
  // aftermath) — the tune then sits on veil+name with no watchdog able to
  // fire, since the loading watchdog is only created after this line.
  try {
    await Promise.race([
      state.player.attach(videoEl),
      new Promise((_, rej) => setTimeout(() => rej(new Error('attach-timeout')), 8000)),
    ]);
  } catch (e) {
    console.error('Player attach failed:', e);
    try {
      await Promise.race([
        state.player.destroy(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('attach-destroy-timeout')), 2000)),
      ]);
    } catch {}
    state.player = null;
    return false;
  }
  return true;
}

function notifyBufferingProgress() {
  if (state.isBuffering && !state.initialLoadPending && state.bufferingCallback) {
    state.bufferingCallback(true, getBufferingPercent());
  }
}

function onPlayEvent() {
  showPlayState(false);
}

function onPauseEvent() {
  showPlayState(true);
}

function onVideoError() {
  if (!state.videoElement) return;
  const err = state.videoElement.error;
  if (!err) return;
  // #16: ignore our own teardown clearing (src='' + load() fires code 4).
  try {
    if (shouldIgnoreVideoError({ code: err.code, message: err.message, srcEmpty: !state.videoElement.src })) return;
  } catch {}
  const now = Date.now();
  // Debounce: ignore duplicate errors within 3s
  if (now - state.lastVideoErrorTime < 3000) return;
  state.lastVideoErrorTime = now;
  state.videoErrorCount++;
  const mediaErrorMessages = {
    1: 'Video playback was aborted',
    2: 'A network error occurred while loading the video',
    3: 'The video could not be decoded — unsupported codec or corrupt stream',
    4: 'Video source not supported on this device — try a different quality',
  };
  const msg = mediaErrorMessages[err.code] || 'Video error (code ' + err.code + ')';
  logEvent('ERROR', 'Video element error: ' + msg + ' (code=' + err.code + ', mediaErr=' + (err.message || '') + ')');
  if (state.videoErrorCount >= 2 && state.currentChannel) {
    // 2+ native errors in a row — this stream format is likely unsupported
    logEvent(
      'ERROR',
      'Channel appears unsupported on this device: ' +
        (state.currentChannel.name || state.currentChannel.url.slice(0, 60)),
    );
    showError('This channel could not play. Pick a different channel.');
    state.videoErrorCount = 0;
  }
}

function onVideoStalled() {
  if (!state.videoElement || state.videoElement.paused) return;
  clearTimeout(state.stalledTimer);
  state.stalledTimer = setTimeout(() => {
    if (!state.videoElement || state.videoElement.paused) return;
    const currentTime = state.videoElement.currentTime;
    if (state.videoElement.readyState < 3 && currentTime === (state.videoElement._lastStallTime || 0)) {
      logEvent('WARN', 'Video stalled for 10s — may not be playable on this device');
      showError('This channel is taking too long to load. Please wait or try a different channel.');
    }
    state.videoElement._lastStallTime = currentTime;
  }, 10000);
}

function onVideoWaiting() {
  // Clear stalled timer since waiting is normal during buffering
  clearTimeout(state.stalledTimer);
}

export function onBuffering(callback) {
  state.bufferingCallback = callback;
}

export function onTrackChange(callback) {
  state.trackCallback = callback;
}

export function onChannelAdvance(callback) {
  state.channelAdvanceCallback = callback;
}

export function onTokenExpired(callback) {
  state.tokenExpiredCallback = callback;
}

// Silent-retry counter for the single-narrative status line: the UI shows a
// light " • try N" suffix once retries begin, instead of retry sentences.
export function onTuneAttempt(callback) {
  state.tuneAttemptCallback = callback;
}

function notifyTuneAttempt() {
  try {
    if (state.tuneAttemptCallback) state.tuneAttemptCallback(state.tuneAttempt);
  } catch {}
}

export function getActiveTrack() {
  if (!state.player) return null;
  const tracks = state.player.getVariantTracks();
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

// BUG-014: Shaka reports error 4000 when it cannot guess a stream's format
// from the URL (no extension) or the server's Content-Type. Probe the first
// bytes of the stream ourselves and return the format Shaka should use.
// Returns null when the format cannot be determined.
async function probeChannelFormat(channel) {
  if (!channel) return null;
  const controller = new AbortController();
  state.probeController = controller;
  try {
    const authedUrl = withAuthQuery(channel.url, channel.authQuery);
    const targetUrl = channel.useProxy ? toProxied(authedUrl) : authedUrl;
    if (!targetUrl) return null;

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
    try {
      await reader.cancel();
    } catch {}
    clearTimeout(timer);
    if (state.probeController === controller) state.probeController = null;
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
      if (
        bytes[start] === 0x47 &&
        bytes[start + 188] === 0x47 &&
        bytes[start + 376] === 0x47 &&
        bytes[start + 564] === 0x47
      ) {
        return 'video/mp2t';
      }
    }
    return null;
  } catch (e) {
    if (state.probeController === controller) state.probeController = null;
    logEvent('WARN', 'Format probe failed: ' + (e && e.message ? e.message : e));
    return null;
  }
}

export async function loadChannel(channel) {
  if (!channel) return false;

  if (channel.drm && !isEmeSupported()) {
    // EME is secure-context-gated: localhost works, http://<lan-ip> does not.
    const insecure = typeof window !== 'undefined' && window.isSecureContext === false;
    logEvent(
      'ERROR',
      'DRM not available — EME is not supported in this browser/context' +
        (insecure ? ' (insecure context — open the player via http://localhost:5173, not a LAN IP)' : ''),
    );
    showError(
      insecure
        ? 'Protected channels need a secure page. Open via localhost instead of LAN IP.'
        : 'This channel is protected and cannot play here. Try a different channel.',
    );
    return false;
  }

  const myToken = ++state.loadToken;
  const prevUrl = state.currentChannel ? state.currentChannel.url : null;
  state.currentChannel = channel;
  channel.useProxy = isProxyEnabledFor(channel.url);
  state.useAvplay = false;
  avplay.stop();
  // Hard cut: silence the old picture instantly — the async destroy below
  // can take seconds, and its frames must not linger behind the new tune.
  try {
    if (state.videoElement && !state.videoElement.paused) state.videoElement.pause();
  } catch {}
  // A previous tune's format probe must not outlive the switch.
  try {
    if (state.probeController) state.probeController.abort();
  } catch {}
  state.probeController = null;
  stopBlackWatchdog();

  clearTimeout(state.reconnectTimer);
  clearInterval(state.loadingTimeout);
  state.loadingTimeout = null;
  state.reconnectPending = false;
  stopStallWatchdog();
  hideError();
  showLoading(true);
  state.advancePending = false;
  state.userPaused = false;
  // 401/403 retry budget survives same-URL reloads (mid-playback token
  // refresh calls loadChannel directly) — reset only on channel switch or
  // explicit reload, so the "advance after 3 failed retries" branch below
  // is reachable. Unconditional reset here made that branch dead code.
  // #16: the same applies to every per-tune counter — a dead channel's
  // errors/retries must not poison the next tune.
  if (tuneCountersReset(prevUrl, channel.url)) {
    state.lastResortAttempts = 0;
    state.reconnectAttempts = 0;
    state.consecutiveErrors = 0;
    state.videoErrorCount = 0;
    state.lastVideoErrorTime = 0;
    state.hardReloads = 0;
    state.tuneAttempt = 1;
  } else {
    // Same-URL re-entry is always a silent retry of the current tune —
    // count it for the status line suffix.
    state.tuneAttempt++;
  }
  notifyTuneAttempt();

  let url = withAuthQuery(channel.url, channel.authQuery);
  if (state.reconnectAttempts > 0) {
    const sep = url.indexOf('?') >= 0 ? '&' : '?';
    url += sep + '_t=' + Date.now();
  }

  // Channels already known to need native playback skip Shaka entirely.
  // #16: still destroy the previous Shaka instance first — otherwise its
  // network requests and error events stay alive behind the native playback.
  if (state.avplayPreferredUrls.has(channel.url) && avplay.isAvailable()) {
    await destroyPlayer(state.videoElement);
    if (myToken !== state.loadToken) return false;
    state.currentChannel = channel;
    return loadViaAvplay(channel, myToken);
  }

  // Direct-media URLs (raw .ts/.mp4/…, never HLS/DASH manifests) go native
  // first on Tizen: Shaka has no top-level parser for them, so a Shaka-first
  // attempt just hangs until the watchdog kills it. DRM stays on Shaka (CDM).
  // On native failure (recorded, never retried) the Shaka path below runs as
  // a second chance. Desktop has no native stack — unchanged behavior.
  if (!channel.drm && avplay.isAvailable() && !state.avplayFailedUrls.has(channel.url) && detectMimeType(url)) {
    await destroyPlayer(state.videoElement);
    if (myToken !== state.loadToken) return false;
    state.currentChannel = channel;
    const okNative = await loadViaAvplay(channel, myToken);
    if (myToken !== state.loadToken) return false;
    if (okNative) {
      state.avplayPreferredUrls.add(channel.url);
      return true;
    }
  }

  try {
    // Always destroy and recreate the player on every channel switch.
    // On Tizen, Shaka's unload/load can hang forever when stuck on a failed
    // network request. Destroy+recreate guarantees a clean slate.
    const el = state.videoElement;
    const tDestroy = Date.now();
    await destroyPlayer(el);
    if (myToken !== state.loadToken) return false;
    const tInit = Date.now();

    if (el) {
      const ok = await initPlayer(el);
      if (!ok) {
        // Never fail silently: an unfinished attach used to wedge the tune
        // on veil+name with no recovery able to fire.
        if (myToken === state.loadToken) {
          showError('This channel could not start. Try another channel, or reselect to try again.');
        }
        return false;
      }
    }
    if (state.videoElement) state.videoElement.classList.remove('hidden');
    state.currentChannel = channel;
    if (myToken !== state.loadToken) return false;

    if (channel.drm) {
      // T-034: prefer the multi-key map; fall back to the legacy single pair.
      const clearKeys = channel.drm.clearKeys || (channel.drm.keyId ? { [channel.drm.keyId]: channel.drm.key } : {});
      state.player.configure({ drm: { clearKeys } });
    } else {
      state.player.configure({ drm: { clearKeys: {} } });
    }

    // Timeout: if player.load hangs for 15s, show feedback and destroy
    // the player so the pending load() promise rejects.
    // Staged UX: spinner owns the screen until load() resolves.
    // Activity-aware timeout: the old single 15s shot killed slow-but-working
    // loads (Shaka's own retry cycle alone spans ~30s). Kill only a truly
    // stalled load: no Shaka request/response activity for 15s, hard cap 60s.
    // Staged UX: spinner owns the screen until load() resolves.
    state.initialLoadPending = true;
    state.lastShakaActivity = Date.now();
    const loadStart = Date.now();
    state.loadingTimeout = setInterval(() => {
      if (myToken !== state.loadToken) {
        clearInterval(state.loadingTimeout);
        state.loadingTimeout = null;
        return;
      }
      const idleFor = Date.now() - state.lastShakaActivity;
      const elapsed = Math.round((Date.now() - loadStart) / 1000);
      if (elapsed >= 10 && state.currentChannel) {
        showTuneElapsed(state.currentChannel.name, elapsed);
      }
      if (idleFor >= 15000 || Date.now() - loadStart > 60000) {
        clearInterval(state.loadingTimeout);
        state.loadingTimeout = null;
        logEvent(
          'WARN',
          'Load stalled (idle ' +
            Math.round(idleFor / 1000) +
            's, lastREQ=' +
            state.lastShakaReq +
            ', lastRESP=' +
            state.lastShakaResp +
            ')',
        );
        showError('This channel is not responding. It may be turned off right now.');
        // #16: drop our reference once the destroy is kicked off — the
        // pending load() rejects from here and its catch recreates the
        // player if this tune is still current. Without this the next
        // switch double-destroys a dead instance (the "destroy hung" loop).
        if (state.player) state.player.destroy().catch(() => {});
        state.player = null;
        if (state.videoElement) {
          state.videoElement.src = '';
          state.videoElement.load();
        }
      }
    }, 5000);

    // Note: do not add a side fetch of the master here — it doubles requests
    // and feeds server rate-limit storms.
    if (myToken !== state.loadToken) return false;

    // Detect MIME type for direct TS/MP4 stream URLs (common in IPTV playlists).
    // Without this hint, Shaka may fail to identify the format and show a black screen.
    // A probed format (BUG-014) takes priority over URL-pattern detection.
    // Look the probe up by clean channel URL: `url` may carry a `?_t` cache
    // buster (BUG-017) while the probe is stored under the original URL.
    const mimeType = state.sniffedMimeUrls.get(channel.url) || detectMimeType(url);
    const tLoad = Date.now();
    if (mimeType) {
      logEvent('INFO', 'Detected MIME type: ' + mimeType + ' for ' + url.slice(0, 80));
      await state.player.load(url, undefined, mimeType);
    } else {
      await state.player.load(url);
    }
    clearInterval(state.loadingTimeout);
    state.loadingTimeout = null;

    if (myToken !== state.loadToken) return false;

    // Load done — first frame is up. Hand buffering state to the pill UI.
    state.initialLoadPending = false;
    showLoading(false);
    if (state.isBuffering && state.bufferingCallback) state.bufferingCallback(true, getBufferingPercent());
    state.reconnectAttempts = 0;
    state.consecutiveErrors = 0;
    state.lastResortAttempts = 0;
    state.videoErrorCount = 0;
    state.hardReloads = 0;
    // Autoplay miss: make sure the fresh load actually plays instead of
    // sitting paused with the channel name on screen.
    if (state.videoElement && state.videoElement.paused && !state.userPaused) tryResumeVideo();
    startStallWatchdog();
    startBlackWatchdog();
    logEvent(
      'INFO',
      'Loaded: ' +
        (channel.name || channel.url.slice(0, 60)) +
        ' (destroy ' +
        (tInit - tDestroy) +
        'ms, init ' +
        (tLoad - tInit) +
        'ms, load ' +
        (Date.now() - tLoad) +
        'ms)',
    );
    return true;
  } catch (error) {
    clearInterval(state.loadingTimeout);
    state.loadingTimeout = null;
    if (myToken !== state.loadToken) return false;

    state.initialLoadPending = false;
    showLoading(false);
    state.videoErrorCount = 0;

    if (error && error.code === 7000) return false;

    // After a timeout, the player was destroyed above. Recreate it so the
    // next channel switch works.
    if (error && (error.message === 'Load timed out' || error.name === 'DestroyedError')) {
      logEvent('WARN', 'Load abandoned — recreating player for next attempt');
      const el = state.videoElement;
      await destroyPlayer(el);
      if (el && myToken === state.loadToken) {
        await initPlayer(el);
      }
      // #16: only the still-current tune may schedule its own retry.
      if (myToken === state.loadToken && state.reconnectAttempts < 3) {
        scheduleReconnect();
      } else if (myToken === state.loadToken) {
        showError('Could not load this channel after several tries. It may be turned off or not available on your TV.');
        logEvent('ERROR', 'Reconnect limit reached — ' + (channel.name || channel.url.slice(0, 60)));
      }
      return false;
    }

    // Shaka could not guess the stream format from the URL (error 4000).
    // Many IPTV servers hide the channel type behind tokenized links with no
    // file extension. Probe the first bytes and retry with the right hint.
    if (error && error.code === 4000 && state.currentChannel && !state.sniffTriedUrls.has(state.currentChannel.url)) {
      state.sniffTriedUrls.add(state.currentChannel.url);
      const crashedChannel = state.currentChannel;
      const tokenAtCatch = state.loadToken;
      probeChannelFormat(crashedChannel).then((mime) => {
        if (tokenAtCatch !== state.loadToken) return; // user switched channels meanwhile
        if (!mime) {
          logEvent('WARN', 'Could not identify channel format: ' + crashedChannel.url.slice(0, 100));
          showError('This channel could not be identified. Try a different channel.');
          return;
        }
        state.sniffedMimeUrls.set(crashedChannel.url, mime);
        logEvent(
          'INFO',
          'Identified channel format: ' + mime + ' for ' + crashedChannel.url.slice(0, 80) + ' — retrying',
        );
        loadChannel(crashedChannel);
      });
      return false;
    }

    if (isRecoverable(error)) {
      logEvent('WARN', 'Load failed (recoverable ' + error.code + ')');
      if (state.reconnectAttempts < 3) {
        scheduleReconnect();
      } else if (shouldTryNative(error) && myToken === state.loadToken) {
        // Last resort: the native pipeline ignores CORS and survives relays
        // that defeat the browser stack (e.g. workers without ACAO headers).
        // Tried once — a native failure is recorded and never retried.
        logEvent('WARN', 'Shaka retries exhausted — trying native playback');
        const okNative = await switchToAvplay();
        if (myToken !== state.loadToken) return false;
        return okNative === true;
      } else {
        showError(getErrorMessage(error) + ' — channel may be turned off');
      }
      return false;
    }

    // BUG-017: tokenized servers reject loads with 403/401 when the token
    // went stale between playlist fetch and segment fetch. Every loadChannel()
    // refetches the master playlist (fresh token), so retry twice first.
    if (error && error.code === 1001 && state.currentChannel && state.reconnectAttempts < 2) {
      const status = error.data && error.data[1];
      if (status === 403 || status === 401) {
        logEvent('WARN', 'Access denied at load (' + status + ') — retrying with fresh token');
        scheduleReconnect();
        return false;
      }
    }

    if (isNativeLoadCrash(error) && state.currentChannel && !state.pdtFallbackUrls.has(state.currentChannel.url)) {
      // Retry once with HLS program-date-time sync disabled (BUG-013): some
      // HLS streams crash inside Shaka's PDT handling, which v1.7.0 enabled.
      state.pdtFallbackUrls.add(state.currentChannel.url);
      const crashedChannel = state.currentChannel;
      const tokenAtCatch = state.loadToken;
      logEvent(
        'WARN',
        'Native crash loading channel — retrying without PDT sync: ' +
          (crashedChannel.name || crashedChannel.url.slice(0, 80)),
      );
      setTimeout(() => {
        if (tokenAtCatch === state.loadToken) loadChannel(crashedChannel);
      }, 1200);
      return false;
    }

    if (isNativeLoadCrash(error)) {
      logEvent(
        'ERROR',
        'Channel failed to load (native crash): ' +
          (state.currentChannel ? state.currentChannel.name + ' | ' + state.currentChannel.url.slice(0, 100) : '?') +
          ' — ' +
          (error.message || ''),
      );
      if (typeof console !== 'undefined') console.error('Channel load crashed inside Shaka:', error, error.stack);
      showError(
        'This channel could not start — it uses a stream format this player could not handle. Try another channel.',
      );
      return false;
    }

    logEvent('ERROR', 'Failed to load — ' + getErrorMessage(error));
    showError(getErrorMessage(error));
    return false;
  }
}

async function destroyPlayer(keepElement) {
  stopStallWatchdog();
  stopBlackWatchdog();
  state.useAvplay = false;
  clearTimeout(state.reconnectTimer);
  clearInterval(state.loadingTimeout);
  state.loadingTimeout = null;
  clearTimeout(state.stalledTimer);
  state.reconnectPending = false;
  if (state.player) {
    const t0 = Date.now();
    try {
      // Two-phase teardown: unload first (stops streaming, detaches MSE,
      // closes CDM sessions while the engine is still coherent), then
      // destroy the shell. A straight destroy() hangs on Tizen when network
      // or EME work is mid-flight — leaked ClearKey sessions then fail later
      // DRM tunes intermittently ("sometimes plays, sometimes not").
      await Promise.race([
        state.player.unload(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('unload-timeout')), 2000)),
      ]);
    } catch {
      logEvent('WARN', 'Player unload hung — forcing destroy');
    }
    try {
      // destroy() hanging forever == eternal spinner, so force on after 5s.
      await Promise.race([
        state.player.destroy(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('destroy-timeout')), 5000)),
      ]);
      logEvent('INFO', 'Player destroy took ' + (Date.now() - t0) + 'ms');
    } catch {
      logEvent('WARN', 'Player destroy hung (' + (Date.now() - t0) + 'ms) — continuing anyway');
    }
    state.player = null;
  }
  if (state.videoElement) {
    state.videoElement.src = '';
    state.videoElement.load();
  }
  state.currentChannel = null;
  state.isBuffering = false;
  if (!keepElement) {
    state.videoElement = null;
  }
}

function isRenderingFrames() {
  try {
    return (
      !!state.videoElement &&
      !state.videoElement.paused &&
      !state.videoElement.ended &&
      state.videoElement.readyState >= 3 &&
      state.videoElement.currentTime > 0
    );
  } catch {
    return false;
  }
}

// Same-URL grace reload for 401/403: backs off instead of hammering, and
// is generation-guarded — a newer tune must not be clobbered by a stale
// timer, which previously caused duplicate reloads and bogus "retry 0/3"
// logs after a successful recovery.
function scheduleForbiddenReload(status, attempt, delay) {
  state.reconnectAttempts = Math.max(state.reconnectAttempts, 1);
  const tokenAtSchedule = state.loadToken;
  const channelAtSchedule = state.currentChannel;
  setTimeout(() => {
    if (tokenAtSchedule !== state.loadToken) return;
    logEvent('INFO', status + ' retry ' + attempt + '/3 — reloading channel');
    if (channelAtSchedule) loadChannel(channelAtSchedule);
  }, delay);
}

function handlePlayerError(error) {
  if (!error) return;

  // Ignore interruptions from switching channels
  if (error.code === 7000) return;

  try {
    const sinceAdapt = state.lastAdaptationAt ? Math.round((Date.now() - state.lastAdaptationAt) / 1000) + 's' : 'n/a';
    logEvent(
      'ERROR',
      'Shaka error code=' + error.code + ' height=' + (getActiveHeight() || '?') + ' sinceAdapt=' + sinceAdapt,
    );
  } catch {}

  console.error('Shaka error:', error);

  // Suppress errors while auto-advance is pending
  if (state.advancePending) return;

  // The branch logic lives in player/recovery.js as a pure plan (T-120). This
  // function's job is now to snapshot the state it needs and perform whatever
  // side effect comes back.
  const plan = planRecovery(error, {
    currentChannel: state.currentChannel,
    advancePending: state.advancePending,
    initialLoadPending: state.initialLoadPending,
    loadingTimeout: state.loadingTimeout,
    renderingFrames: isRenderingFrames(),
    pdtFallbackTried: !!(state.currentChannel && state.pdtFallbackUrls.has(state.currentChannel.url)),
    hasTokenExpiredCallback: !!state.tokenExpiredCallback,
    hasAdvanceCallback: !!state.channelAdvanceCallback,
    consecutiveErrors: state.consecutiveErrors,
    lastResortAttempts: state.lastResortAttempts,
    hardReloads: state.hardReloads,
    reconnectAttempts: state.reconnectAttempts,
    segment404: state.segment404Url
      ? { url: state.segment404Url, attempts: state.segment404Attempts, lastAt: state.segment404LastAt }
      : null,
    now: Date.now(),
  });

  // Apply the counter changes the plan decided on, before acting.
  if (plan.counters) {
    for (const [key, value] of Object.entries(plan.counters)) {
      state[key] = value;
    }
  }
  if (plan.segment404) {
    state.segment404Url = plan.segment404.url;
    state.segment404Attempts = plan.segment404.attempts;
    state.segment404LastAt = plan.segment404.lastAt;
  }

  switch (plan.action) {
    case 'none':
    case 'ignore':
      // Transient blip while rendering: Shaka retries internally, a genuine
      // outage stalls the video and the stall watchdog handles that path.
      return;

    case 'pdt-retry':
      // BUG-013: retry once with HLS PDT sync disabled.
      state.pdtFallbackUrls.add(plan.url);
      logEvent(
        'WARN',
        'Native crash during playback — reloading without PDT sync: ' +
          (state.currentChannel.name || state.currentChannel.url.slice(0, 80)),
      );
      loadChannel(state.currentChannel);
      return;

    case 'forbidden-reload':
      // Same-URL grace reload with backoff. Only the plain auth-retry path
      // logged the segment line in the original; the refresh fallback did not.
      if (plan.log === 'segment-retry') {
        logEvent('WARN', plan.status + ' on segment — retry ' + state.lastResortAttempts + '/3');
      }
      scheduleForbiddenReload(plan.status, state.lastResortAttempts, plan.delay);
      return;

    case 'token-refresh':
      logEvent('WARN', httpStatusOf(error) + ' persists after reloads — refetching playlist for a fresh link');
      state.tokenExpiredCallback(state.currentChannel);
      return;

    case 'reload':
      if (plan.segment404) {
        logEvent(
          'WARN',
          'Live segment 404 — reload ' +
            state.segment404Attempts +
            '/3 for a fresh edge: ' +
            (state.currentChannel.name || state.currentChannel.url.slice(0, 80)),
        );
      }
      loadChannel(state.currentChannel);
      return;

    case 'reconnect':
      scheduleReconnect(plan.delay);
      return;

    case 'giveup':
      giveUpTune();
      return;

    case 'advance':
      showTerminal(error);
      state.advancePending = true;
      logEvent('INFO', '3 retries exhausted — advancing to next channel');
      showError('This channel link has expired. Moving to the next channel...');
      {
        const advanceToken = state.loadToken;
        setTimeout(() => {
          // #16: never yank the user away from a channel they picked meanwhile.
          if (advanceToken !== state.loadToken) return;
          state.advancePending = false;
          logEvent('INFO', 'Advancing channel');
          state.channelAdvanceCallback();
        }, plan.delay);
      }
      return;

    case 'terminal':
    default:
      if (plan.message === 'crash') {
        logEvent(
          'ERROR',
          'Playback crashed (native): ' +
            (state.currentChannel ? state.currentChannel.name + ' | ' + state.currentChannel.url.slice(0, 100) : '?') +
            ' — ' +
            (error.message || ''),
        );
        if (typeof console !== 'undefined') console.error('Shaka runtime crash:', error, error.stack);
        showError(
          'This channel stopped unexpectedly — it uses a stream format this player could not handle. Try another channel.',
        );
        return;
      }
      showTerminal(error);
      return;
  }
}

// The shared "unrecoverable" reporting, used by both the terminal branch and
// the advance branch (the original logged and showed the error before it began
// advancing, so both paths must report).
function showTerminal(error) {
  logEvent(
    'ERROR',
    'Unrecoverable error ' +
      error.code +
      ' (' +
      (state.currentChannel && state.currentChannel.name ? state.currentChannel.name : 'unknown') +
      ') — ' +
      getErrorMessage(error),
  );
  showError(getErrorMessage(error));
}

// Native last resort for loads the browser stack cannot complete: CORS-blocked
// relays (HTTP_ERROR 1002 with no usable response), timeouts, and status-less
// failures. A server that explicitly answered (e.g. 404) is excluded — native
// would get the same answer. Tried once per URL: desktop has no native stack,
// and native failures are recorded in avplayFailedUrls by loadViaAvplay.
function shouldTryNative(error) {
  if (!error || !state.currentChannel) return false;
  if (!avplay.isAvailable()) return false;
  if (state.avplayFailedUrls.has(state.currentChannel.url)) return false;
  if (error.code === 1002 || error.code === 1003) return true;
  if (error.code === 1001 && !(error.data && error.data[1])) return true;
  return false;
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

function scheduleReconnect(delay) {
  if (state.reconnectPending || !state.currentChannel) return;
  state.reconnectPending = true;
  state.reconnectAttempts++;
  const tokenAtSchedule = state.loadToken;
  const channelAtSchedule = state.currentChannel;
  logEvent('WARN', 'Reconnecting (attempt ' + state.reconnectAttempts + ')');
  // Live recovery: fast initial retry, cap at 10s. The delay is computed by
  // planRecovery() so the pure logic stays the single source (T-120); the
  // fallback keeps the other call sites in this file working unchanged.
  const wait = delay === undefined ? Math.min(1000 * state.reconnectAttempts, 10000) : delay;

  state.reconnectTimer = setTimeout(() => {
    state.reconnectPending = false;
    // #16: a dead channel's pending retry must not clobber the next tune —
    // only fire when nothing switched channels meanwhile.
    if (tokenAtSchedule !== state.loadToken) return;
    if (state.currentChannel && state.currentChannel === channelAtSchedule) {
      loadChannel(state.currentChannel);
    }
  }, wait);
}

// Liveness proof while a load hangs: the tune veil keeps counting seconds
// so a slow connect never looks frozen on a bare logo.
function showTuneElapsed(name, seconds) {
  const veil = document.getElementById('loading');
  const nameEl = document.getElementById('loading-name');
  if (veil && nameEl && !veil.classList.contains('hidden')) {
    nameEl.textContent = (name || 'Loading') + ' • ' + seconds + 's';
  }
}

function startStallWatchdog() {
  stopStallWatchdog();
  state.lastStallTime = state.videoElement ? state.videoElement.currentTime : 0;
  state.lastStallCheck = Date.now();
  state.stallDeferrals = 0;
  state.stallWatchdogTimer = setInterval(() => {
    if (!state.videoElement || state.videoElement.ended) return;
    if (
      shouldResumePlayback({
        paused: state.videoElement.paused,
        ended: state.videoElement.ended,
        userPaused: state.userPaused,
      })
    ) {
      // Late stale teardown (or autoplay miss) paused the video behind our
      // back — resume it. If the src was wiped too, play() fails and the
      // frozen clock below escalates to a reload instead of sitting stuck.
      tryResumeVideo();
      return;
    }
    if (state.videoElement.paused) return; // user's own pause — leave alone
    const now = state.videoElement.currentTime;
    if (now === state.lastStallTime && Date.now() - state.lastStallCheck > 15000) {
      // Slow, not stuck: Shaka fetched recently (segments flowing, decoder
      // waiting, or its own retry cycle running) — re-baseline and keep
      // waiting instead of trampling a recovery already in flight. Bounded:
      // a chatty-but-starved stream still escalates after ~60s frozen.
      if (isNetworkActive(state.lastShakaActivity, Date.now())) {
        state.stallDeferrals++;
        if (!stallPatienceExceeded(state.stallDeferrals)) {
          state.lastStallTime = now;
          state.lastStallCheck = Date.now();
          return;
        }
        logEvent('WARN', 'Stall persists with live network — restarting anyway');
      }
      state.consecutiveErrors++;
      logEvent('WARN', 'Stall detected (no progress for 15s)');
      if (state.consecutiveErrors >= 3) {
        state.consecutiveErrors = 0;
        state.hardReloads++;
        // Budgeted per tune — see handlePlayerError above. A channel that
        // never produces frames must end on a message, not on an app kill.
        if (hardReloadDecision(state.hardReloads) === 'giveup') {
          giveUpTune();
          return;
        }
        logEvent('INFO', '3 stalls — hard reloading channel');
        loadChannel(state.currentChannel);
      } else {
        scheduleReconnect();
      }
      return;
    }
    if (now !== state.lastStallTime) {
      state.lastStallTime = now;
      state.lastStallCheck = Date.now();
      state.stallDeferrals = 0;
    }
  }, 2000);
}

function stopStallWatchdog() {
  if (state.stallWatchdogTimer) {
    clearInterval(state.stallWatchdogTimer);
    state.stallWatchdogTimer = null;
  }
}

// play() as a statement: tolerates old engines where play() returns
// undefined. Rejections are logged (a failing resume means the src was
// wiped — the frozen clock below then escalates to a reload).
function tryResumeVideo() {
  try {
    if (!state.videoElement) return;
    const pending = state.videoElement.play();
    if (pending && typeof pending.catch === 'function') {
      pending.catch((e) => {
        logEvent('WARN', 'Resume attempt failed: ' + (e && e.name ? e.name : e));
      });
    }
  } catch (e) {
    logEvent('WARN', 'Resume attempt threw: ' + (e && e.message ? e.message : e));
  }
}

// Terminal give-up for a tune that never produces frames: tear everything
// down and say so — then STOP. No timers, no reloads. Retrying forever is
// what wedged the app on endless buffering until the TV killed it. The user
// can still tune away (keys work again) or hit reload for a fresh budget.
function giveUpTune() {
  stopStallWatchdog();
  stopBlackWatchdog();
  clearTimeout(state.reconnectTimer);
  state.reconnectPending = false;
  state.consecutiveErrors = 0;
  state.initialLoadPending = false;
  if (state.bufferingCallback) state.bufferingCallback(false);
  const el = state.videoElement;
  const label = state.currentChannel ? state.currentChannel.name || state.currentChannel.url.slice(0, 60) : '?';
  destroyPlayer(el).catch(() => {});
  logEvent('ERROR', 'Giving up tune after 3 hard reloads — ' + label);
  showError('This channel stopped responding. Try another channel, or reload to try again.');
}

// BUG-020: zero presented frames while data is present means the browser
// decoder rejected the stream (interlaced MBAFF, …). Migrate to native.
// Ground truth is requestVideoFrameCallback (presented frames); the decoded-
// frame counter is only a fallback (a stuck decoder can still count frames).
function startBlackWatchdog() {
  stopBlackWatchdog();
  const tokenAtStart = state.loadToken;
  state.blackWatchTimer = setTimeout(() => {
    state.blackWatchTimer = null;
    if (tokenAtStart !== state.loadToken || state.useAvplay || !state.currentChannel) return;
    if (state.avplayFailedUrls.has(state.currentChannel.url)) return;
    if (!state.videoElement || state.videoElement.paused) return;
    if (state.videoElement.readyState < 2) return;
    if (typeof state.videoElement.requestVideoFrameCallback === 'function') {
      let painted = false;
      try {
        state.videoElement.requestVideoFrameCallback(() => {
          painted = true;
        });
      } catch {
        return;
      }
      setTimeout(() => {
        if (tokenAtStart !== state.loadToken || state.useAvplay || !state.currentChannel) return;
        if (state.videoElement && state.videoElement.paused) return;
        if (!painted) onBlackScreen();
      }, 3000);
      return;
    }
    let total = -1;
    try {
      const q = state.videoElement.getVideoPlaybackQuality();
      if (q) total = q.totalVideoFrames || 0;
    } catch {
      return;
    }
    if (total >= 0 && total < 5) onBlackScreen();
  }, 9000);
}

function onBlackScreen() {
  if (!state.currentChannel || state.avplayFailedUrls.has(state.currentChannel.url)) return;
  if (!avplay.isAvailable()) {
    logEvent('ERROR', 'Undecodable stream, no native fallback: ' + state.currentChannel.url.slice(0, 100));
    showError('This channel uses a format the TV browser cannot display. Try a native player app for this channel.');
    return;
  }
  state.avplayPreferredUrls.add(state.currentChannel.url);
  switchToAvplay();
}

function stopBlackWatchdog() {
  if (state.blackWatchTimer) {
    clearTimeout(state.blackWatchTimer);
    state.blackWatchTimer = null;
  }
}

function avplayStreamUrl(channel) {
  return withAuthQuery(channel.url, channel.authQuery);
}

async function loadViaAvplay(channel, myToken) {
  showLoading(true);
  hideError();
  if (state.videoElement) state.videoElement.classList.add('hidden');
  avplay.onBuffering((buffering, percent) => {
    if (myToken !== state.loadToken) return;
    showLoading(false);
    if (typeof percent === 'number') state.avplayBufferPercent = percent;
    if (state.bufferingCallback) state.bufferingCallback(buffering, percent);
  });
  avplay.onError((type) => {
    if (myToken !== state.loadToken) return;
    state.avplayFailedUrls.add(channel.url);
    state.avplayPreferredUrls.delete(channel.url);
    logEvent('ERROR', 'Native playback failed (' + type + '): ' + (channel.name || channel.url.slice(0, 60)));
    showError('This channel could not play on your TV. Try another channel.');
  });
  let referer = null;
  if (channel.customHeaders) {
    for (const [k, v] of Object.entries(channel.customHeaders)) {
      if (k.toLowerCase() === 'referer') referer = v;
    }
  }
  const ok = await avplay.play(avplayStreamUrl(channel), {
    userAgent: channel.userAgent || null,
    referer,
  });
  if (myToken !== state.loadToken) return false;
  showLoading(false);
  if (!ok) {
    state.avplayFailedUrls.add(channel.url);
    state.avplayPreferredUrls.delete(channel.url);
    showError('This channel could not play on your TV. Try another channel.');
    return false;
  }
  state.useAvplay = true;
  hideError();
  state.reconnectAttempts = 0;
  state.consecutiveErrors = 0;
  state.lastResortAttempts = 0;
  state.hardReloads = 0;
  logEvent('INFO', 'Playing natively: ' + (channel.name || channel.url.slice(0, 60)));
  return true;
}

async function switchToAvplay() {
  const channel = state.currentChannel;
  const tokenAtSwitch = state.loadToken;
  if (!channel || !avplay.isAvailable()) return false;
  stopBlackWatchdog();
  stopStallWatchdog();
  logEvent('WARN', 'No frames rendered — switching to native playback: ' + (channel.name || channel.url.slice(0, 80)));
  if (state.player) {
    try {
      await state.player.destroy();
    } catch {}
    state.player = null;
  }
  if (tokenAtSwitch !== state.loadToken) return false;
  return loadViaAvplay(channel, tokenAtSwitch);
}

// Force-reload the current channel (e.g. from R key or remote)
export function setAutoQuality(enabled) {
  if (state.useAvplay) return;
  if (!state.player) return;
  state.player.configure({ abr: { enabled } });
}

export function reloadChannel() {
  if (state.useAvplay && state.currentChannel) {
    const ch = state.currentChannel;
    state.consecutiveErrors = 0;
    state.advancePending = false;
    state.lastResortAttempts = 0;
    state.hardReloads = 0;
    state.tuneAttempt = 0; // loadChannel++ makes this a fresh first try
    loadChannel(ch);
    return;
  }
  if (!state.currentChannel) return;
  state.consecutiveErrors = 0;
  state.advancePending = false;
  state.lastResortAttempts = 0;
  state.hardReloads = 0;
  state.tuneAttempt = 0; // loadChannel++ makes this a fresh first try
  clearTimeout(state.reconnectTimer);
  state.reconnectPending = false;
  loadChannel(state.currentChannel);
}

export function stop() {
  avplay.stop();
  state.userPaused = false;
  if (state.videoElement) state.videoElement.classList.remove('hidden');
  destroyPlayer().catch(() => {});
  showLoading(false);
  hideError();
}

export function togglePlay() {
  if (state.useAvplay) {
    if (state.avplayPaused) {
      state.avplayPaused = false;
      avplay.resume();
    } else {
      state.avplayPaused = true;
      avplay.pause();
    }
    return;
  }
  if (!state.videoElement) return;

  if (state.videoElement.paused) {
    state.userPaused = false;
    tryResumeVideo();
  } else {
    state.userPaused = true;
    state.videoElement.pause();
  }
}

export function isNativeAvailable() {
  return avplay.isAvailable();
}

export function getPlayer() {
  return state.player;
}

export function getBufferingPercent() {
  if (state.useAvplay) return state.avplayBufferPercent;
  if (!state.videoElement) return 0;
  const buffered = state.videoElement.buffered;
  let end = 0;
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= state.videoElement.currentTime && state.videoElement.currentTime <= buffered.end(i)) {
      end = buffered.end(i);
    }
  }
  const ahead = Math.max(0, end - state.videoElement.currentTime);
  return Math.min(100, Math.round((ahead / 20) * 100));
}

export function getResolutions() {
  if (state.useAvplay || !state.player) return [];
  const tracks = state.player.getVariantTracks();
  const heights = [...new Set(tracks.map((t) => t.height))].filter(Boolean).sort((a, b) => a - b);
  return heights;
}

export function selectResolution(height) {
  if (state.useAvplay || !state.player) return;

  if (height == null) {
    state.player.configure({ abr: { enabled: true } });
    return;
  }

  const tracks = state.player.getVariantTracks().filter((t) => t.height === height);
  if (tracks.length) {
    state.player.configure({ abr: { enabled: false } });
    state.player.selectVariantTrack(tracks[0], true);
  }
}

// Multi-audio channels (languages, commentary, …): Shaka exposes the
// audio adaptations compatible with the current video track. Selecting one
// keeps video ABR running — only the audio switches.
export function getAudioTracks() {
  if (state.useAvplay || !state.player) return [];
  try {
    return state.player.getAudioTracks().map((t) => ({
      id: t.id,
      language: t.language || '',
      label: t.label || '',
      active: !!t.active,
    }));
  } catch {
    return [];
  }
}

export function getActiveAudioId() {
  const active = getAudioTracks().find((t) => t.active);
  return active ? active.id : null;
}

export function selectAudioTrackById(id) {
  if (state.useAvplay || !state.player || id == null) return;
  try {
    const track = state.player.getAudioTracks().find((t) => t.id === id);
    if (track) state.player.selectAudioTrack(track);
  } catch (e) {
    console.warn('Audio select failed:', e);
  }
}

export function getVideoElement() {
  return state.videoElement;
}

// Loading veil (spinner + channel name, centered): showLoading(false) drops
// only the spinner — the name stays put through the buffering phase until
// the first frame (hideLoading) or an error clears the stage.
function showLoading(show) {
  const el = document.getElementById('loading');
  if (el) el.classList.toggle('hidden', !show);
  const spinner = el ? el.querySelector('.spinner') : null;
  if (spinner) spinner.classList.toggle('hidden', !show);
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

function showPlayState(paused) {
  const el = document.getElementById('play-state');
  if (el) {
    el.classList.toggle('hidden', !paused);
  }
}

function showError(message) {
  hideLoading();
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
    3016: 'This channel could not be decoded on your TV. Try a different channel.',
    3017: 'This channel is too high quality for this TV. Try a lower-quality channel.',
    3018: 'The live stream broke up. Trying again — if it persists, try another channel.',
    4000: 'This channel could not be identified. Try a different channel.',
    4032: 'This channel stopped playing in a format your TV accepts. Trying again — if it persists, try another channel.',
  };

  // BAD_HTTP_STATUS (1001): the real HTTP status is in error.data[1].
  if (code === 1001) {
    const status = error.data && error.data[1];
    if (status === 403) return 'This channel is not allowed to play. You may need a subscription or different access.';
    if (status === 401)
      return 'This channel is not allowing access right now. Its link may have expired — try again in a bit.';
    if (status === 404) return 'This channel was not found. The link may have changed.';
    if (typeof status === 'number' && status >= 500)
      return 'The channel server is having problems. Please try again later.';
    if (typeof status === 'number' && status)
      return 'Channel returned an error (code ' + status + '). Please try again.';
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
