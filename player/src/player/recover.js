// Recovery side effects (T-123). Pure decisions live in recovery.js.
import { deps } from './deps.js';
import { state } from './state.js';
import { planRecovery, httpStatusOf } from './recovery.js';
import * as avplay from '../avplay.js';

export function handlePlayerError(error) {
  if (!error) return;

  // Ignore interruptions from switching channels
  if (error.code === 7000) return;

  try {
    const sinceAdapt = state.lastAdaptationAt ? Math.round((Date.now() - state.lastAdaptationAt) / 1000) + 's' : 'n/a';
    deps.logEvent(
      'ERROR',
      'Shaka error code=' + error.code + ' height=' + (deps.getActiveHeight() || '?') + ' sinceAdapt=' + sinceAdapt,
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
    renderingFrames: deps.isRenderingFrames(),
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
      deps.logEvent(
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
        deps.logEvent('WARN', plan.status + ' on segment — retry ' + state.lastResortAttempts + '/3');
      }
      scheduleForbiddenReload(plan.status, state.lastResortAttempts, plan.delay);
      return;

    case 'token-refresh':
      deps.logEvent('WARN', httpStatusOf(error) + ' persists after reloads — refetching playlist for a fresh link');
      state.tokenExpiredCallback(state.currentChannel);
      return;

    case 'reload':
      if (plan.segment404) {
        deps.logEvent(
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
      deps.showTerminal(error);
      state.advancePending = true;
      deps.logEvent('INFO', '3 retries exhausted — advancing to next channel');
      deps.showError('This channel link has expired. Moving to the next channel...');
      {
        const advanceToken = state.loadToken;
        setTimeout(() => {
          // #16: never yank the user away from a channel they picked meanwhile.
          if (advanceToken !== state.loadToken) return;
          state.advancePending = false;
          deps.logEvent('INFO', 'Advancing channel');
          state.channelAdvanceCallback();
        }, plan.delay);
      }
      return;

    case 'terminal':
    default:
      if (plan.message === 'crash') {
        deps.logEvent(
          'ERROR',
          'Playback crashed (native): ' +
            (state.currentChannel ? state.currentChannel.name + ' | ' + state.currentChannel.url.slice(0, 100) : '?') +
            ' — ' +
            (error.message || ''),
        );
        if (typeof console !== 'undefined') console.error('Shaka runtime crash:', error, error.stack);
        deps.showError(
          'This channel stopped unexpectedly — it uses a stream format this player could not handle. Try another channel.',
        );
        return;
      }
      deps.showTerminal(error);
      return;
  }
}

export function scheduleForbiddenReload(status, attempt, delay) {
  state.reconnectAttempts = Math.max(state.reconnectAttempts, 1);
  const tokenAtSchedule = state.loadToken;
  const channelAtSchedule = state.currentChannel;
  setTimeout(() => {
    if (tokenAtSchedule !== state.loadToken) return;
    deps.logEvent('INFO', status + ' retry ' + attempt + '/3 — reloading channel');
    if (channelAtSchedule) deps.loadChannel(channelAtSchedule);
  }, delay);
}

export function scheduleReconnect(delay) {
  if (state.reconnectPending || !state.currentChannel) return;
  state.reconnectPending = true;
  state.reconnectAttempts++;
  const tokenAtSchedule = state.loadToken;
  const channelAtSchedule = state.currentChannel;
  deps.logEvent('WARN', 'Reconnecting (attempt ' + state.reconnectAttempts + ')');
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

export function shouldTryNative(error) {
  if (!error || !state.currentChannel) return false;
  if (!avplay.isAvailable()) return false;
  if (state.avplayFailedUrls.has(state.currentChannel.url)) return false;
  if (error.code === 1002 || error.code === 1003) return true;
  if (error.code === 1001 && !(error.data && error.data[1])) return true;
  return false;
}

export function giveUpTune() {
  deps.stopStallWatchdog();
  deps.stopBlackWatchdog();
  clearTimeout(state.reconnectTimer);
  state.reconnectPending = false;
  state.consecutiveErrors = 0;
  state.initialLoadPending = false;
  if (state.bufferingCallback) state.bufferingCallback(false);
  const el = state.videoElement;
  const label = state.currentChannel ? state.currentChannel.name || state.currentChannel.url.slice(0, 60) : '?';
  deps.destroyPlayer(el).catch(() => {});
  deps.logEvent('ERROR', 'Giving up tune after 3 hard reloads — ' + label);
  deps.showError('This channel stopped responding. Try another channel, or reload to try again.');
}

// This slice wires its own deps slots. The hub only assembles the API.
Object.assign(deps, {
  handlePlayerError,
  scheduleForbiddenReload,
  scheduleReconnect,
  shouldTryNative,
  giveUpTune,
});
