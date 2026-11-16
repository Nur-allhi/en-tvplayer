import { describe, it, expect } from 'vitest';
import {
  httpStatusOf,
  isTransientBlip,
  isNativeLoadCrash,
  isRecoverable,
  isAuthFailure,
  isLiveSegment404,
  planRecovery,
} from './recovery.js';

// T-120: these tests characterise the recovery branches that used to be buried
// inside handlePlayerError's ~165 lines of interleaved side effects. Each test
// pins which decision maps to which action. They are written against the
// behaviour of the ORIGINAL code, before any of it was restructured.

const err = (code, status) => ({ code, data: status ? [null, status] : [] });
const channel = (url = 'https://example.test/live.m3u8') => ({ name: 'Ch', url });

// A context that reaches the plain "recoverable" path with nothing special on.
const base = (over = {}) => ({
  currentChannel: channel(),
  advancePending: false,
  initialLoadPending: false,
  loadingTimeout: null,
  renderingFrames: false,
  pdtFallbackTried: false,
  hasTokenExpiredCallback: true,
  hasAdvanceCallback: true,
  consecutiveErrors: 0,
  lastResortAttempts: 0,
  hardReloads: 0,
  reconnectAttempts: 0,
  segment404: null,
  now: 1_700_000_000_000,
  ...over,
});

describe('error classification', () => {
  it('reads the HTTP status from data[1]', () => {
    expect(httpStatusOf(err(1001, 403))).toBe(403);
    expect(httpStatusOf(err(1001))).toBeNull();
    expect(httpStatusOf(null)).toBeNull();
  });

  it('treats 5xx, 429 and 408 as transient blips', () => {
    expect(isTransientBlip(err(1001, 500))).toBe(true);
    expect(isTransientBlip(err(1001, 429))).toBe(true);
    expect(isTransientBlip(err(1001, 408))).toBe(true);
    expect(isTransientBlip(err(1002))).toBe(true);
    expect(isTransientBlip(err(1003))).toBe(true);
  });

  it('does not treat client errors or auth failures as blips', () => {
    expect(isTransientBlip(err(1001, 403))).toBe(false);
    expect(isTransientBlip(err(1001, 404))).toBe(false);
    expect(isTransientBlip(err(1000))).toBe(false);
    expect(isTransientBlip(null)).toBe(false);
  });

  it('recognises a native crash but not a shaka error', () => {
    expect(isNativeLoadCrash(new TypeError('x is undefined'))).toBe(true);
    expect(isNativeLoadCrash({ message: 'Cannot read properties of null (reading 0)' })).toBe(true);
    expect(isNativeLoadCrash(err(3018))).toBe(false);
    expect(isNativeLoadCrash(new Error('plain'))).toBe(false);
    expect(isNativeLoadCrash(null)).toBe(false);
  });

  it('marks only the documented codes recoverable', () => {
    expect(isRecoverable(err(1000))).toBe(false);
    expect(isRecoverable(err(1001, 500))).toBe(true);
    expect(isRecoverable(err(1001, 403))).toBe(false);
    expect(isRecoverable(err(1002))).toBe(true);
    expect(isRecoverable(err(1003))).toBe(true);
    expect(isRecoverable(err(3014))).toBe(true);
    expect(isRecoverable(err(3015))).toBe(true);
    expect(isRecoverable(err(3016))).toBe(true);
    expect(isRecoverable(err(3018))).toBe(true);
    expect(isRecoverable(err(4032))).toBe(true);
    expect(isRecoverable(null)).toBe(false);
  });

  it('identifies only 401 and 403 as auth failures', () => {
    expect(isAuthFailure(err(1001, 401))).toBe(true);
    expect(isAuthFailure(err(1001, 403))).toBe(true);
    expect(isAuthFailure(err(1001, 404))).toBe(false);
    expect(isAuthFailure(err(1002))).toBe(false);
  });

  it('separates a live-segment 404 from an initial-load 404', () => {
    expect(isLiveSegment404(err(1001, 404), base())).toBe(true);
    expect(isLiveSegment404(err(1001, 404), base({ initialLoadPending: true }))).toBe(false);
    expect(isLiveSegment404(err(1001, 404), base({ currentChannel: null }))).toBe(false);
    expect(isLiveSegment404(err(1001, 403), base())).toBe(false);
  });
});

describe('planRecovery — nothing to do', () => {
  it('ignores a missing error', () => {
    expect(planRecovery(null, base()).action).toBe('none');
  });

  it('ignores 7000, Shaka\'s "operation aborted" for a channel switch', () => {
    expect(planRecovery(err(7000), base()).action).toBe('none');
  });

  it('stands down while an auto-advance is pending', () => {
    expect(planRecovery(err(1002), base({ advancePending: true })).action).toBe('none');
  });
});

describe('planRecovery — transient blip while rendering', () => {
  it('leaves playback alone and clears the error slate', () => {
    const plan = planRecovery(err(1001, 503), base({ renderingFrames: true, consecutiveErrors: 2 }));
    expect(plan.action).toBe('ignore');
    expect(plan.counters).toEqual({ consecutiveErrors: 0 });
  });

  it('does not ignore the same blip when nothing is rendering', () => {
    const plan = planRecovery(err(1001, 503), base({ renderingFrames: false }));
    expect(plan.action).not.toBe('ignore');
    expect(plan.action).toBe('reconnect');
  });
});

describe('planRecovery — native crash (BUG-013)', () => {
  it('retries once with PDT sync disabled', () => {
    const plan = planRecovery(new TypeError('boom'), base());
    expect(plan.action).toBe('pdt-retry');
    expect(plan.url).toBe('https://example.test/live.m3u8');
  });

  it('is terminal when the PDT fallback was already tried', () => {
    const plan = planRecovery(new TypeError('boom'), base({ pdtFallbackTried: true }));
    expect(plan.action).toBe('terminal');
    expect(plan.message).toBe('crash');
  });

  it('defers to the load catch while a load is in flight', () => {
    // `loadingTimeout` being set means load() is still pending; the original
    // skips the whole PDT-crash branch and falls through to the terminal
    // handler, so this must not become 'pdt-retry'.
    const plan = planRecovery(new TypeError('boom'), base({ loadingTimeout: 1234 }));
    expect(plan.action).toBe('terminal');
    expect(plan.message).toBe('error');
  });
});

describe('planRecovery — 401/403 mid-playback', () => {
  it('does a backed-off same-URL reload on the first two attempts', () => {
    const first = planRecovery(err(1001, 403), base({ lastResortAttempts: 0 }));
    expect(first.action).toBe('forbidden-reload');
    expect(first.status).toBe(403);
    expect(first.log).toBe('segment-retry');
    expect(first.counters.lastResortAttempts).toBe(1);

    const second = planRecovery(err(1001, 403), base({ lastResortAttempts: 1 }));
    expect(second.action).toBe('forbidden-reload');
    expect(second.counters.lastResortAttempts).toBe(2);
  });

  it('backs off exponentially and caps at 16s', () => {
    expect(planRecovery(err(1001, 403), base({ lastResortAttempts: 0 })).delay).toBe(4000);
    expect(planRecovery(err(1001, 403), base({ lastResortAttempts: 1 })).delay).toBe(8000);
  });

  it('asks for a fresh link on the third attempt', () => {
    const plan = planRecovery(err(1001, 403), base({ lastResortAttempts: 2 }));
    expect(plan.action).toBe('token-refresh');
    expect(plan.counters.lastResortAttempts).toBe(3);
  });

  it('falls back to a reload when no token-refresh callback is wired', () => {
    const plan = planRecovery(err(1001, 401), base({ lastResortAttempts: 2, hasTokenExpiredCallback: false }));
    expect(plan.action).toBe('forbidden-reload');
    // The original logged nothing on this fallback path, unlike the plain
    // retry path — so `log` must stay unset.
    expect(plan.log).toBeUndefined();
  });

  it('advances to the next channel on the fourth attempt', () => {
    const plan = planRecovery(err(1001, 403), base({ lastResortAttempts: 3 }));
    expect(plan.action).toBe('advance');
    expect(plan.delay).toBe(4000);
  });

  it('advances even with no advance callback only via the terminal path', () => {
    const plan = planRecovery(err(1001, 403), base({ lastResortAttempts: 3, hasAdvanceCallback: false }));
    expect(plan.action).toBe('terminal');
  });

  it('counts an auth failure toward the consecutive-error budget', () => {
    // Load-bearing: a 401/403 also bumps consecutiveErrors, which is what lets
    // a later recoverable error trip the hard-reload budget.
    const plan = planRecovery(err(1001, 403), base({ lastResortAttempts: 0, consecutiveErrors: 2 }));
    expect(plan.counters.consecutiveErrors).toBe(3);
  });
});

describe('planRecovery — recoverable errors and the reload budget', () => {
  it('reconnects with a capped backoff below the threshold', () => {
    const plan = planRecovery(err(1002), base({ consecutiveErrors: 0 }));
    expect(plan.action).toBe('reconnect');
    expect(plan.delay).toBe(1000);
    // reconnectAttempts is incremented by scheduleReconnect(), not by the
    // plan — returning it here would double-count.
    expect(plan.counters.reconnectAttempts).toBeUndefined();
  });

  it('caps the reconnect delay at 10s', () => {
    const plan = planRecovery(err(1002), base({ reconnectAttempts: 20 }));
    expect(plan.delay).toBe(10000);
  });

  it('hard reloads on the third consecutive error and resets the count', () => {
    const plan = planRecovery(err(3018), base({ consecutiveErrors: 2, hardReloads: 0 }));
    expect(plan.action).toBe('reload');
    expect(plan.counters.consecutiveErrors).toBe(0);
    expect(plan.counters.hardReloads).toBe(1);
  });

  it('gives up when the hard-reload budget is exhausted', () => {
    const plan = planRecovery(err(3018), base({ consecutiveErrors: 2, hardReloads: 3 }));
    expect(plan.action).toBe('giveup');
  });

  it('gives up at exactly three hard reloads', () => {
    // Matches the original: hardReloads is incremented (2 -> 3) and THEN
    // compared, so the third reload is the one that gives up, not the fourth.
    const plan = planRecovery(err(1003), base({ consecutiveErrors: 2, hardReloads: 2 }));
    expect(plan.action).toBe('giveup');
    expect(plan.counters.hardReloads).toBe(3);
  });

  it('still reloads at one hard reload', () => {
    const plan = planRecovery(err(1003), base({ consecutiveErrors: 2, hardReloads: 1 }));
    expect(plan.action).toBe('reload');
    expect(plan.counters.hardReloads).toBe(2);
  });
});

describe('planRecovery — live segment 404', () => {
  it('reloads for a fresh edge on the first 404', () => {
    const plan = planRecovery(err(1001, 404), base({ initialLoadPending: false }));
    expect(plan.action).toBe('reload');
    expect(plan.segment404).toEqual({
      url: 'https://example.test/live.m3u8',
      attempts: 1,
      lastAt: 1_700_000_000_000,
    });
  });

  it('reloads up to three times for the same URL', () => {
    const prev = { url: 'https://example.test/live.m3u8', attempts: 2, lastAt: 1_700_000_000_000 };
    const plan = planRecovery(err(1001, 404), base({ segment404: prev }));
    expect(plan.action).toBe('reload');
    expect(plan.segment404.attempts).toBe(3);
  });

  it('is terminal once the per-URL budget is spent', () => {
    const prev = { url: 'https://example.test/live.m3u8', attempts: 3, lastAt: 1_700_000_000_000 };
    const plan = planRecovery(err(1001, 404), base({ segment404: prev }));
    expect(plan.action).toBe('terminal');
    expect(plan.message).toBe('segment404');
  });

  it('starts a fresh budget for a different URL', () => {
    const prev = { url: 'https://other.test/live.m3u8', attempts: 3, lastAt: 1_700_000_000_000 };
    const plan = planRecovery(err(1001, 404), base({ segment404: prev }));
    expect(plan.action).toBe('reload');
    expect(plan.segment404.attempts).toBe(1);
  });

  it('starts a fresh budget after the 5-minute window', () => {
    const prev = { url: 'https://example.test/live.m3u8', attempts: 3, lastAt: 0 };
    const plan = planRecovery(err(1001, 404), base({ segment404: prev }));
    expect(plan.action).toBe('reload');
  });

  it('treats an initial-load 404 as terminal, not a live-edge miss', () => {
    const plan = planRecovery(err(1001, 404), base({ initialLoadPending: true }));
    expect(plan.action).toBe('terminal');
    expect(plan.message).toBe('error');
  });
});
