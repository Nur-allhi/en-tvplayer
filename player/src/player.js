import { getSettings } from './config.js';
import { withAuthQuery } from './lib/url.js';
import { hardReloadDecision, shouldResumePlayback, isNetworkActive, stallPatienceExceeded } from './logic.js';
import * as avplay from './avplay.js';
import { state } from './player/state.js';
import { planRecovery, httpStatusOf } from './player/recovery.js';
import { deps } from './player/deps.js';
import { sniffMimeFromBytes } from './lib/mime.js';
// T-126: init/attach and teardown live in their own slice. The hub imports them
// to register deps slots and re-exports initPlayer so the 24-name surface holds.
import { initPlayer, destroyPlayer, notifyBufferingProgress } from './player/init.js';
export { initPlayer };
// T-127: load/reload moved to their own slice. Re-export keeps the 24-name
// public surface while the hub stays behaviour-identical.
import { loadChannel, reloadChannel } from './player/load.js';
export { loadChannel, reloadChannel };
// T-122: subscription setters and stream/track queries now live in their own
// slices. player.js both uses and re-exports them so its public surface stays
// exactly the same 24 names until the index hub lands (T-123).
import { getActiveHeight, getBufferingPercent } from './player/stream.js';
export { onBuffering, onTrackChange, onChannelAdvance, onTokenExpired, onTuneAttempt } from './player/events.js';
export {
  getActiveTrack,
  getActiveHeight,
  getActiveBandwidth,
  isEmeSupported,
  setAutoQuality,
  getPlayer,
  getBufferingPercent,
  getResolutions,
  selectResolution,
  getAudioTracks,
  getActiveAudioId,
  selectAudioTrackById,
  getVideoElement,
} from './player/stream.js';

// T-124: register the concrete implementations in the hub. Slices call through
// these slots instead of importing player.js back, so the init -> handleError
// -> load -> init cycle becomes a one-way wire-up. Function declarations are
// hoisted, so this can live here alongside the imports.
Object.assign(deps, {
  loadChannel,
  initPlayer,
  handlePlayerError,
  scheduleReconnect,
  showError,
  logEvent,
  getErrorMessage,
  giveUpTune,
  probeChannelFormat,
  startStallWatchdog,
  stopStallWatchdog,
  startBlackWatchdog,
  stopBlackWatchdog,
  notifyBufferingProgress,
  isRenderingFrames,
  showLoading,
  getBufferingPercent,
  showPlayState,
  toProxied,
  // T-127
  isProxyEnabledFor,
  notifyTuneAttempt,
  showTuneElapsed,
  tryResumeVideo,
  hideError,
  loadViaAvplay,
  switchToAvplay,
  shouldTryNative,
  destroyPlayer,
});

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

function notifyTuneAttempt() {
  try {
    if (state.tuneAttemptCallback) state.tuneAttemptCallback(state.tuneAttempt);
  } catch {}
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
    return sniffMimeFromBytes(bytes);
  } catch (e) {
    if (state.probeController === controller) state.probeController = null;
    logEvent('WARN', 'Format probe failed: ' + (e && e.message ? e.message : e));
    return null;
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
      deps.loadChannel(state.currentChannel);
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
      deps.loadChannel(state.currentChannel);
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
      deps.loadChannel(state.currentChannel);
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
        deps.loadChannel(state.currentChannel);
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
