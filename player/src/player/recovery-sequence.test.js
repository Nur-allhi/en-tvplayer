import { describe, it, expect } from 'vitest';
import { planRecovery } from './recovery.js';

// T-120: counter arithmetic. The original interleaved its increments with the
// branches, and getting one wrong is silent — the app keeps running with a
// retry ladder that is half or double the intended length. These tests pin the
// exact values, and the sequence-level tests below replay a whole incident to
// check the ladder still terminates where it used to.

const err = (code, status) => ({ code, data: status ? [null, status] : [] });
const CH = { name: 'Ch', url: 'https://example.test/live.m3u8' };

function run(ctx, plan) {
  const next = { ...ctx };
  if (plan.counters) Object.assign(next, plan.counters);
  if (plan.segment404) next.segment404 = plan.segment404;
  return next;
}

const ctx = (over = {}) => ({
  currentChannel: CH,
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

describe('consecutive-error budget', () => {
  it('reaches the hard-reload threshold on the third recoverable error', () => {
    let c = ctx();
    const actions = [];
    // Three recoverable errors, each reconnect below the threshold.
    for (let i = 0; i < 2; i++) {
      const plan = planRecovery(err(1002), c);
      actions.push(plan.action);
      c = run(c, plan);
    }
    const third = planRecovery(err(1002), c);
    actions.push(third.action);
    expect(actions).toEqual(['reconnect', 'reconnect', 'reload']);
  });

  it('does not trip the threshold early', () => {
    const plan = planRecovery(err(1002), ctx({ consecutiveErrors: 0 }));
    expect(plan.action).toBe('reconnect');
  });

  it('lets three separate hard-reload cycles exhaust the budget', () => {
    // Each cycle needs 3 consecutive errors, then increments hardReloads.
    let c = ctx();
    const outcomes = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      c = { ...c, consecutiveErrors: 2 }; // one error short of the threshold
      const plan = planRecovery(err(3018), c);
      outcomes.push(plan.action);
      c = run(c, plan);
    }
    // reload, reload, giveup — the third hard reload is the one that gives up.
    expect(outcomes).toEqual(['reload', 'reload', 'giveup']);
  });
});

describe('auth retry ladder', () => {
  it('walks reload, reload, refresh, advance', () => {
    let c = ctx();
    const actions = [];
    for (let i = 0; i < 4; i++) {
      const plan = planRecovery(err(1001, 403), c);
      actions.push(plan.action);
      c = run(c, plan);
    }
    expect(actions).toEqual(['forbidden-reload', 'forbidden-reload', 'token-refresh', 'advance']);
  });

  it('advances on the fourth failure, not the third', () => {
    const third = planRecovery(err(1001, 403), ctx({ lastResortAttempts: 2 }));
    expect(third.action).toBe('token-refresh');
    const fourth = planRecovery(err(1001, 403), ctx({ lastResortAttempts: 3 }));
    expect(fourth.action).toBe('advance');
  });
});

describe('segment-404 budget', () => {
  it('allows three reloads then condemns the link', () => {
    let c = ctx();
    const actions = [];
    for (let i = 0; i < 4; i++) {
      const plan = planRecovery(err(1001, 404), c);
      actions.push(plan.action);
      c = run(c, plan);
    }
    expect(actions).toEqual(['reload', 'reload', 'reload', 'terminal']);
  });

  it('keeps counting per URL rather than globally', () => {
    let c = run(ctx(), planRecovery(err(1001, 404), ctx()));
    c = run(c, planRecovery(err(1001, 404), c));
    c = run(c, planRecovery(err(1001, 404), c));
    expect(c.segment404.attempts).toBe(3);
    // Same URL: condemned.
    expect(planRecovery(err(1001, 404), c).action).toBe('terminal');
    // A different channel starts clean.
    const other = { ...c, currentChannel: { name: 'Two', url: 'https://other.test/x.m3u8' } };
    expect(planRecovery(err(1001, 404), other).action).toBe('reload');
  });
});
