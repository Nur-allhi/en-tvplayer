import { describe, it, expect } from 'vitest';
import { planRecovery } from './recovery.js';

// Split out of recovery.test.js to stay inside the 300-LOC rule. These are the
// terminal branch and the invariants every branch must hold, as opposed to the
// per-branch behaviour covered in the sibling file.

const err = (code, status) => ({ code, data: status ? [null, status] : [] });

const base = (over = {}) => ({
  currentChannel: { name: 'Ch', url: 'https://example.test/live.m3u8' },
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

describe('planRecovery — terminal errors', () => {
  it('is terminal for an unrecoverable scheme error', () => {
    const plan = planRecovery(err(1000), base());
    expect(plan.action).toBe('terminal');
    expect(plan.message).toBe('error');
  });

  it('is terminal for a 400 with no recovery path', () => {
    const plan = planRecovery(err(1001, 400), base());
    expect(plan.action).toBe('terminal');
  });

  it('is terminal when there is no channel to recover', () => {
    const plan = planRecovery(err(1001, 403), base({ currentChannel: null }));
    expect(plan.action).toBe('terminal');
  });
});

describe('planRecovery — invariants', () => {
  it('always returns an action and never throws on junk input', () => {
    for (const bad of [{}, { code: 'x' }, { code: 1001, data: null }, null, undefined]) {
      expect(() => planRecovery(bad, base())).not.toThrow();
      expect(typeof planRecovery(bad, base()).action).toBe('string');
    }
  });

  it('never mutates the context it is given', () => {
    const ctx = base({ consecutiveErrors: 1, lastResortAttempts: 1 });
    const snapshot = JSON.parse(JSON.stringify(ctx));
    planRecovery(err(1001, 403), ctx);
    planRecovery(err(3018), ctx);
    planRecovery(err(1001, 404), ctx);
    expect(ctx).toEqual(snapshot);
  });

  it('only ever returns counter keys that exist on the player state', () => {
    // A typo here would silently write an unrelated property on `state`.
    const allowed = new Set(['consecutiveErrors', 'lastResortAttempts', 'hardReloads']);
    const plans = [
      planRecovery(err(1002), base()),
      planRecovery(err(3018), base({ consecutiveErrors: 2 })),
      planRecovery(err(1001, 403), base()),
      planRecovery(err(1001, 404), base()),
      planRecovery(err(1000), base()),
    ];
    for (const plan of plans) {
      for (const key of Object.keys(plan.counters || {})) {
        expect(allowed.has(key)).toBe(true);
      }
    }
  });
});
