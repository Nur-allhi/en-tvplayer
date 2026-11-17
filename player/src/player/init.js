// Player init/attach and teardown slice (T-126). Moved from player.js so the
// hub can stay behaviour-identical. Cross-slice calls go through deps slots —
// importing the hub back would form the init -> handleError -> load -> init
// cycle the modularity guard forbids. Only the hub wires those slots at boot.
import shaka from 'shaka-player';
import config, { getSettings } from '../config.js';
import { withAuthQuery, redactUrl } from '../lib/url.js';
import { isStalePlayerEvent, shouldIgnoreVideoError } from '../logic.js';
import { getActiveTrack } from './stream.js';
import { state } from './state.js';
import { deps } from './deps.js';

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
          request.uris[0] = deps.toProxied(request.uris[0]);
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
    deps.handlePlayerError(event.detail);
  });

  state.player.addEventListener('buffering', (event) => {
    if (isStalePlayerEvent(gen, state.loadToken)) return;
    state.isBuffering = event.buffering;
    if (state.initialLoadPending) return;
    deps.showLoading(event.buffering);
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

async function destroyPlayer(keepElement) {
  deps.stopStallWatchdog();
  deps.stopBlackWatchdog();
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
      deps.logEvent('WARN', 'Player unload hung — forcing destroy');
    }
    try {
      // destroy() hanging forever == eternal spinner, so force on after 5s.
      await Promise.race([
        state.player.destroy(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('destroy-timeout')), 5000)),
      ]);
      deps.logEvent('INFO', 'Player destroy took ' + (Date.now() - t0) + 'ms');
    } catch {
      deps.logEvent('WARN', 'Player destroy hung (' + (Date.now() - t0) + 'ms) — continuing anyway');
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

function notifyBufferingProgress() {
  if (state.isBuffering && !state.initialLoadPending && state.bufferingCallback) {
    state.bufferingCallback(true, deps.getBufferingPercent());
  }
}

function onPlayEvent() {
  deps.showPlayState(false);
}

function onPauseEvent() {
  deps.showPlayState(true);
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
  deps.logEvent(
    'ERROR',
    'Video element error: ' + msg + ' (code=' + err.code + ', mediaErr=' + (err.message || '') + ')',
  );
  if (state.videoErrorCount >= 2 && state.currentChannel) {
    // 2+ native errors in a row — this stream format is likely unsupported
    deps.logEvent(
      'ERROR',
      'Channel appears unsupported on this device: ' +
        (state.currentChannel.name || state.currentChannel.url.slice(0, 60)),
    );
    deps.showError('This channel could not play. Pick a different channel.');
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
      deps.logEvent('WARN', 'Video stalled for 10s — may not be playable on this device');
      deps.showError('This channel is taking too long to load. Please wait or try a different channel.');
    }
    state.videoElement._lastStallTime = currentTime;
  }, 10000);
}

function onVideoWaiting() {
  // Clear stalled timer since waiting is normal during buffering
  clearTimeout(state.stalledTimer);
}

// This slice wires its own deps slots. The hub only assembles the API.
Object.assign(deps, {
  initPlayer,
  destroyPlayer,
  notifyBufferingProgress,
});
