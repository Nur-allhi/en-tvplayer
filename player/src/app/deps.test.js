import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { deps } from './deps.js';

// T-152a: the app deps registry is the M5 cycle breaker, mirroring
// player/deps.js. These tests pin the two properties every slice relies on:
// a registered slot is exactly the function that gets invoked, and an unwired
// slot throws loudly rather than silently no-opping boot or remote input.

const SLOT_NAMES = [
  // Boot.
  'showBootSplash',
  'hideBootSplash',
  // Onboarding.
  'showFirstRun',
  'showOnboarding',
  'hideOnboarding',
  'updateOnboardFocus',
  'selectOnboarding',
  'isOnboardingOpen',
  // What's New.
  'checkWhatsNew',
  'showWhatsNew',
  'closeWhatsNew',
  'markVersionSeen',
  'isWhatsNewOpen',
  'hideBootSplashAndMaybeWhatsNew',
  // Startup.
  'init',
  'startPlayer',
  'restoreLastSession',
  'scheduleUpdateCheck',
  'showEmptyState',
  // Remote.
  'handleRemoteAction',
  'registerTizenKeys',
  'zapChannel',
  // Channels + shared UI helpers.
  'handleChannelSelect',
  'refreshChannels',
  'refreshChannelsInBackground',
  'applyFreshChannels',
  'handleStaleToken',
  'showStaleCacheNotice',
  'sortChannels',
  'updateResolutionBadge',
  'getDisplayChannels',
  'refreshProxyMenu',
  'showPlayer',
  'showSettingsPage',
  'showMediaAdd',
  'showProgress',
  'hideProgress',
  'updateProgressPercent',
  'forcePaint',
];

let original;
beforeEach(() => {
  original = {};
  for (const name of SLOT_NAMES) original[name] = deps[name];
});
afterEach(() => {
  for (const name of SLOT_NAMES) deps[name] = original[name];
});

describe('app deps — shape', () => {
  it('is a single mutable object with stable identity', () => {
    expect(typeof deps).toBe('object');
    expect(deps).toBe(deps);
  });

  it('exposes exactly the M5 slots', () => {
    expect(Object.keys(deps).sort()).toEqual([...SLOT_NAMES].sort());
  });

  it('has a function in every slot', () => {
    for (const name of SLOT_NAMES) expect(typeof deps[name]).toBe('function');
  });

  it('keeps a slot function identical across reads until rewired', () => {
    expect(deps.startPlayer).toBe(deps.startPlayer);
    const replacement = () => {};
    deps.startPlayer = replacement;
    expect(deps.startPlayer).toBe(replacement);
  });

  it('has at least ten slots (the registry covers the cross-slice calls)', () => {
    expect(SLOT_NAMES.length).toBeGreaterThanOrEqual(10);
  });
});

describe('app deps — unwired slots fail loudly', () => {
  it('throws when an unwired slot is called', () => {
    expect(() => deps.init()).toThrow();
  });

  it('names the slot in the error so a missed wiring is diagnosable', () => {
    expect(() => deps.handleRemoteAction()).toThrow(/handleRemoteAction/);
  });

  it('prefixes the error with "app deps" to distinguish it from other registries', () => {
    expect(() => deps.showPlayer()).toThrow(/app deps/);
  });

  it('every unwired slot throws (never a silent no-op)', () => {
    for (const name of SLOT_NAMES) {
      expect(() => deps[name]()).toThrow(/deps/i, `slot ${name} should throw`);
    }
  });
});

describe('app deps — wired slots', () => {
  it('invokes the registered function, not the unwired stub', () => {
    let called = 0;
    deps.showPlayer = () => {
      called += 1;
    };
    deps.showPlayer();
    expect(called).toBe(1);
  });

  it('forwards arguments to the registered function', () => {
    let seen;
    deps.zapChannel = (step) => {
      seen = step;
    };
    deps.zapChannel(-1);
    expect(seen).toBe(-1);
  });

  it('returns the registered function result to the caller', () => {
    deps.isWhatsNewOpen = () => true;
    expect(deps.isWhatsNewOpen()).toBe(true);
  });

  it('last registration wins when a slot is wired twice', () => {
    deps.sortChannels = () => 'first';
    deps.sortChannels = () => 'second';
    expect(deps.sortChannels()).toBe('second');
  });

  it('slots are independent of one another', () => {
    deps.markVersionSeen = () => 'wired';
    expect(deps.markVersionSeen()).toBe('wired');
    expect(() => deps.refreshChannels()).toThrow();
  });

  it('propagates an error thrown inside the registered function', () => {
    deps.handleStaleToken = () => {
      throw new Error('boom');
    };
    expect(() => deps.handleStaleToken()).toThrow('boom');
  });

  it('supports an async registered function', async () => {
    deps.refreshChannelsInBackground = async (x) => x * 2;
    await expect(deps.refreshChannelsInBackground(3)).resolves.toBe(6);
  });

  it('can be bulk-wired via Object.assign, as the hub will do', () => {
    Object.assign(deps, { getDisplayChannels: () => ['a', 'b'] });
    expect(deps.getDisplayChannels()).toEqual(['a', 'b']);
    expect(() => deps.forcePaint()).toThrow();
  });
});
