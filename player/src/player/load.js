// Player load/reload slice (T-127). Moved from player.js so the hub can
// shrink toward the 300-LOC guard. Cross-slice calls go through deps slots —
// importing the hub back would reform the init -> handleError -> load -> init
// cycle. Only the hub wires those slots at boot.
//
// The load-error branch lives in load-error.js: loadChannel is 351 LOC on its
// own, so the catch body was moved in this same ticket to keep this file under
// the guard. Behaviour is unchanged — the two files are one logical function.
import { withAuthQuery } from '../lib/url.js';
import { tuneCountersReset } from '../logic.js';
import { isEmeSupported } from './stream.js';
import * as avplay from '../avplay.js';
import { state } from './state.js';
import { deps } from './deps.js';
import { detectMimeType } from '../lib/mime.js';
import { handleLoadError } from './load-error.js';

export async function loadChannel(channel) {
  if (!channel) return false;

  if (channel.drm && !isEmeSupported()) {
    // EME is secure-context-gated: localhost works, http://<lan-ip> does not.
    const insecure = typeof window !== 'undefined' && window.isSecureContext === false;
    deps.logEvent(
      'ERROR',
      'DRM not available — EME is not supported in this browser/context' +
        (insecure ? ' (insecure context — open the player via http://localhost:5173, not a LAN IP)' : ''),
    );
    deps.showError(
      insecure
        ? 'Protected channels need a secure page. Open via localhost instead of LAN IP.'
        : 'This channel is protected and cannot play here. Try a different channel.',
    );
    return false;
  }

  const myToken = ++state.loadToken;
  const prevUrl = state.currentChannel ? state.currentChannel.url : null;
  state.currentChannel = channel;
  channel.useProxy = deps.isProxyEnabledFor(channel.url);
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
  deps.stopBlackWatchdog();

  clearTimeout(state.reconnectTimer);
  clearInterval(state.loadingTimeout);
  state.loadingTimeout = null;
  state.reconnectPending = false;
  deps.stopStallWatchdog();
  deps.hideError();
  deps.showLoading(true);
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
  deps.notifyTuneAttempt();

  let url = withAuthQuery(channel.url, channel.authQuery);
  if (state.reconnectAttempts > 0) {
    const sep = url.indexOf('?') >= 0 ? '&' : '?';
    url += sep + '_t=' + Date.now();
  }

  // Channels already known to need native playback skip Shaka entirely.
  // #16: still destroy the previous Shaka instance first — otherwise its
  // network requests and error events stay alive behind the native playback.
  if (state.avplayPreferredUrls.has(channel.url) && avplay.isAvailable()) {
    await deps.destroyPlayer(state.videoElement);
    if (myToken !== state.loadToken) return false;
    state.currentChannel = channel;
    return deps.loadViaAvplay(channel, myToken);
  }

  // Direct-media URLs (raw .ts/.mp4/…, never HLS/DASH manifests) go native
  // first on Tizen: Shaka has no top-level parser for them, so a Shaka-first
  // attempt just hangs until the watchdog kills it. DRM stays on Shaka (CDM).
  // On native failure (recorded, never retried) the Shaka path below runs as
  // a second chance. Desktop has no native stack — unchanged behavior.
  if (!channel.drm && avplay.isAvailable() && !state.avplayFailedUrls.has(channel.url) && detectMimeType(url)) {
    await deps.destroyPlayer(state.videoElement);
    if (myToken !== state.loadToken) return false;
    state.currentChannel = channel;
    const okNative = await deps.loadViaAvplay(channel, myToken);
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
    await deps.destroyPlayer(el);
    if (myToken !== state.loadToken) return false;
    const tInit = Date.now();

    if (el) {
      const ok = await deps.initPlayer(el);
      if (!ok) {
        // Never fail silently: an unfinished attach used to wedge the tune
        // on veil+name with no recovery able to fire.
        if (myToken === state.loadToken) {
          deps.showError('This channel could not start. Try another channel, or reselect to try again.');
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
        deps.showTuneElapsed(state.currentChannel.name, elapsed);
      }
      if (idleFor >= 15000 || Date.now() - loadStart > 60000) {
        clearInterval(state.loadingTimeout);
        state.loadingTimeout = null;
        deps.logEvent(
          'WARN',
          'Load stalled (idle ' +
            Math.round(idleFor / 1000) +
            's, lastREQ=' +
            state.lastShakaReq +
            ', lastRESP=' +
            state.lastShakaResp +
            ')',
        );
        deps.showError('This channel is not responding. It may be turned off right now.');
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
      deps.logEvent('INFO', 'Detected MIME type: ' + mimeType + ' for ' + url.slice(0, 80));
      await state.player.load(url, undefined, mimeType);
    } else {
      await state.player.load(url);
    }
    clearInterval(state.loadingTimeout);
    state.loadingTimeout = null;

    if (myToken !== state.loadToken) return false;

    // Load done — first frame is up. Hand buffering state to the pill UI.
    state.initialLoadPending = false;
    deps.showLoading(false);
    if (state.isBuffering && state.bufferingCallback) state.bufferingCallback(true, deps.getBufferingPercent());
    state.reconnectAttempts = 0;
    state.consecutiveErrors = 0;
    state.lastResortAttempts = 0;
    state.videoErrorCount = 0;
    state.hardReloads = 0;
    // Autoplay miss: make sure the fresh load actually plays instead of
    // sitting paused with the channel name on screen.
    if (state.videoElement && state.videoElement.paused && !state.userPaused) deps.tryResumeVideo();
    deps.startStallWatchdog();
    deps.startBlackWatchdog();
    deps.logEvent(
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
    return handleLoadError(error, myToken, channel);
  }
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
  deps.loadChannel(state.currentChannel);
}

// This slice wires its own deps slots. The hub only assembles the API.
Object.assign(deps, {
  loadChannel,
  reloadChannel,
});
