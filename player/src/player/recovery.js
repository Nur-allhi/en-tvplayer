// Recovery decisions for the playback engine (T-120).
//
// This module decides WHAT to do about a playback error. It never does it: no
// timers, no loadChannel, no DOM. The caller in `player.js` reads the returned
// plan and performs the side effect.
//
// That split is what makes the highest-risk logic in the app testable.
// `handlePlayerError` used to be ~165 lines of interleaved decisions and side
// effects, so the only way to check "what happens on a 403 during playback"
// was to drive a real Shaka error through a real player on a TV. Now the
// branching is a pure function of (error, context) and every branch is a plan.
//
// The decision primitives stay in `logic.js` — `segment404Decision`,
// `tokenRecoveryDecision`, `lastResortDecision`, `hardReloadDecision`,
// `forbiddenRetryDelay`. This module composes them; it does not reimplement
// them (T-120, docs/v4.PLAN.md Phase 2).
//
// COUNTERS: the original incremented counters at specific points interleaved
// with the branches, and those increments are load-bearing — a 401/403 also
// bumps `consecutiveErrors`, which is what lets a later recoverable error trip
// the hard-reload budget. So the plan returns the counter values the caller
// must write back, and the order below mirrors the original line for line.

import {
  segment404Decision,
  lastResortDecision,
  tokenRecoveryDecision,
  hardReloadDecision,
  forbiddenRetryDelay,
} from '../logic.js';

// Shaka error codes used below (shaka-player 5.x, lib/util/error.js):
//   1000 UNSUPPORTED_SCHEME · 1001 BAD_HTTP_STATUS (status = data[1])
//   1002 HTTP_ERROR · 1003 TIMEOUT · 3014-3016 MediaSource
//   3018 transmux · 4032 CONTENT_UNSUPPORTED_BY_BROWSER · 7000 OPERATION_ABORTED

export function httpStatusOf(error) {
  return (error && error.data && error.data[1]) || null;
}

export function isTransientBlip(error) {
  if (!error || typeof error.code !== 'number') return false;
  if (error.code === 1002 || error.code === 1003) return true;
  if (error.code === 1001) {
    const status = httpStatusOf(error);
    if (!status) return true;
    return status >= 500 || status === 429 || status === 408;
  }
  return false;
}

// A crash inside Shaka itself rather than a shaka.util.Error: a native
// TypeError thrown from library code, typically the PDT-tag bug (BUG-013).
export function isNativeLoadCrash(error) {
  if (!error) return false;
  if (typeof error.code === 'number') return false; // shaka.util.Error
  if (error instanceof TypeError) return true;
  const msg = error.message || '';
  return /Cannot read propert/.test(msg) && /reading /.test(msg);
}

// Is this error class retryable at all? Not "should we retry now".
export function isRecoverable(error) {
  if (!error) return false;
  if (error.code === 1000) return false;
  if (error.code === 1001) {
    const status = httpStatusOf(error);
    if (!status) return true;
    return status >= 500 || status === 429 || status === 408;
  }
  if (error.code === 1002 || error.code === 1003) return true;
  if (error.code === 3014 || error.code === 3015 || error.code === 3016) return true;
  // BUG-017: stale segments fail to transmux (3018); Shaka then disables the
  // only variant, surfacing as 4032. A fresh load refetches the master
  // playlist and clears the disabled state.
  if (error.code === 3018 || error.code === 4032) return true;
  return false;
}

export function isAuthFailure(error) {
  if (!error || error.code !== 1001) return false;
  const status = httpStatusOf(error);
  return status === 401 || status === 403;
}

// Live-segment 404: the link loaded, so this segment fell off the live edge or
// its per-request token died. An initial-load 404 means the link is dead.
export function isLiveSegment404(error, ctx = {}) {
  if (!error || error.code !== 1001) return false;
  if (!ctx.currentChannel) return false;
  if (ctx.initialLoadPending) return false;
  return httpStatusOf(error) === 404;
}

// ── The plan ─────────────────────────────────────────────────────────────
//
// Actions:
//   'none'              nothing to do (already handled / irrelevant)
//   'ignore'            leave playback alone; Shaka retries internally
//   'pdt-retry'         retry once with HLS PDT sync disabled
//   'forbidden-reload'  same-URL reload after `delay`
//   'token-refresh'     ask the app for a fresh link
//   'reload'            reload the current channel
//   'reconnect'         soft retry after `delay`
//   'giveup'            stop; show the terminal "stopped responding" message
//   'advance'           show the error, then move on after `delay`
//   'terminal'          unrecoverable; show the mapped error message
//
// `ctx` snapshot:
//   { currentChannel, initialLoadPending, advancePending, loadingTimeout,
//     renderingFrames, pdtFallbackTried, hasTokenExpiredCallback,
//     hasAdvanceCallback,
//     consecutiveErrors, lastResortAttempts, hardReloads, reconnectAttempts,
//     segment404, now }
//
// `counters` are the values the caller must write back. Omitted key = unchanged.
export function planRecovery(error, ctx = {}) {
  // 1. No error, or a channel switch aborted an operation.
  if (!error || error.code === 7000) return { action: 'none' };

  // 2. Auto-advance already scheduled; do not fight it.
  if (ctx.advancePending) return { action: 'none' };

  // 3. Transient blip while frames render: Shaka retries internally. Returns
  //    before the increment below, and clears the slate on the way out.
  if (isTransientBlip(error) && ctx.renderingFrames) {
    return { action: 'ignore', counters: { consecutiveErrors: 0 } };
  }

  // 4. Every remaining branch counts the error.
  const consecutiveErrors = (ctx.consecutiveErrors || 0) + 1;
  let lastResortAttempts = ctx.lastResortAttempts || 0;

  // 5. Native crash during playback (not during load — its catch owns that).
  if (isNativeLoadCrash(error) && !ctx.loadingTimeout) {
    const counters = { consecutiveErrors };
    if (ctx.currentChannel && !ctx.pdtFallbackTried) {
      return { action: 'pdt-retry', url: ctx.currentChannel.url, counters };
    }
    return { action: 'terminal', message: 'crash', counters };
  }

  // 6. 401/403 mid-playback: two grace reloads with backoff, then one playlist
  //    refetch for a fresh token, then fall through to the terminal handler.
  let authExhausted = false;
  let authStatus = null;
  if (error.code === 1001 && ctx.currentChannel) {
    authStatus = httpStatusOf(error);
    if (authStatus === 403 || authStatus === 401) {
      lastResortAttempts += 1;
      const policy = tokenRecoveryDecision(lastResortAttempts);
      if (policy === 'reload') {
        return {
          action: 'forbidden-reload',
          status: authStatus,
          delay: forbiddenRetryDelay(lastResortAttempts),
          log: 'segment-retry',
          counters: { consecutiveErrors, lastResortAttempts },
        };
      }
      if (policy === 'refresh') {
        if (ctx.hasTokenExpiredCallback) {
          return { action: 'token-refresh', counters: { consecutiveErrors, lastResortAttempts } };
        }
        // No callback wired: fall back to another reload. The original logged
        // nothing on this path, so `log` stays unset.
        return {
          action: 'forbidden-reload',
          status: authStatus,
          delay: forbiddenRetryDelay(lastResortAttempts),
          counters: { consecutiveErrors, lastResortAttempts },
        };
      }
      // policy === 'advance' — the original falls through, so the terminal
      // handler still logs and shows the error before moving on.
      authExhausted = true;
    }
  }

  // 7. Recoverable error class.
  if (isRecoverable(error)) {
    // After 3 consecutive errors, force a hard reload. Budgeted per tune —
    // uncapped, this destroys/creates forever until the TV kills the app.
    if (consecutiveErrors >= 3) {
      const hardReloads = (ctx.hardReloads || 0) + 1;
      if (hardReloadDecision(hardReloads) === 'giveup') {
        return {
          action: 'giveup',
          counters: { consecutiveErrors, hardReloads, lastResortAttempts },
        };
      }
      return {
        action: 'reload',
        counters: { consecutiveErrors: 0, hardReloads, lastResortAttempts },
      };
    }
    const reconnectAttempts = (ctx.reconnectAttempts || 0) + 1;
    // `reconnectAttempts` is deliberately NOT returned as a counter: the
    // original incremented it inside scheduleReconnect(), which still does.
    // Returning it here would increment twice and halve the retry ladder.
    return {
      action: 'reconnect',
      delay: Math.min(1000 * reconnectAttempts, 10000),
      counters: { consecutiveErrors, lastResortAttempts },
    };
  }

  // 8. Live segment 404 after a successful load: reload for a fresh edge.
  if (isLiveSegment404(error, ctx)) {
    const decision = segment404Decision(ctx.segment404 || null, ctx.currentChannel.url, ctx.now);
    const counters = { consecutiveErrors, lastResortAttempts };
    if (decision.retry) {
      return { action: 'reload', segment404: decision.state, counters };
    }
    return { action: 'terminal', message: 'segment404', segment404: decision.state, counters };
  }

  // 9. Terminal. A 401/403 that exhausted its retries advances instead.
  const counters = { consecutiveErrors, lastResortAttempts };
  if (authExhausted && (authStatus === 403 || authStatus === 401) && ctx.hasAdvanceCallback) {
    if (lastResortDecision(lastResortAttempts) === 'advance') {
      return { action: 'advance', delay: 4000, counters };
    }
  }

  return { action: 'terminal', message: 'error', counters };
}
