import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { deps } from './deps.js';

// T-124: the deps registry is the M2 cycle breaker. These tests pin the two
// properties the slices depend on: a registered slot is exactly the function
// that gets invoked, and an unwired slot never silently no-ops.

const SLOT_NAMES = [
  'loadChannel',
  'initPlayer',
  'handlePlayerError',
  'scheduleReconnect',
  'showError',
  'logEvent',
  'getErrorMessage',
  'giveUpTune',
  'probeChannelFormat',
  'startStallWatchdog',
  'stopStallWatchdog',
  'startBlackWatchdog',
  'stopBlackWatchdog',
  'notifyBufferingProgress',
  'isRenderingFrames',
];

// Snapshot every slot before each test and restore afterwards so registration
// in one test never leaks into another.
let original;
beforeEach(() => {
  original = {};
  for (const name of SLOT_NAMES) original[name] = deps[name];
});
afterEach(() => {
  for (const name of SLOT_NAMES) deps[name] = original[name];
});

describe('player deps — shape', () => {
  it('is a single mutable object', () => {
    expect(typeof deps).toBe('object');
    expect(deps).toBe(deps);
  });

  it('exposes exactly the fifteen M2 slots', () => {
    expect(Object.keys(deps).sort()).toEqual([...SLOT_NAMES].sort());
  });

  it('has a function in every slot', () => {
    for (const name of SLOT_NAMES) expect(typeof deps[name]).toBe('function');
  });
});

describe('player deps — unwired slots fail loudly', () => {
  it('throws when an unwired slot is called', () => {
    expect(() => deps.loadChannel()).toThrow();
  });

  it('names the slot in the error so a missed wiring is diagnosable', () => {
    expect(() => deps.initPlayer()).toThrow(/initPlayer/);
  });

  it('every unwired slot throws (never a silent no-op)', () => {
    for (const name of SLOT_NAMES) {
      expect(() => deps[name]()).toThrow(/deps/i, `slot ${name} should throw`);
    }
  });
});

describe('player deps — wired slots', () => {
  it('invokes the registered function, not the unwired stub', () => {
    let called = 0;
    deps.showError = () => {
      called += 1;
    };
    deps.showError('x');
    expect(called).toBe(1);
  });

  it('forwards arguments to the registered function', () => {
    let seen;
    deps.logEvent = (level, message) => {
      seen = [level, message];
    };
    deps.logEvent('WARN', 'probe failed');
    expect(seen).toEqual(['WARN', 'probe failed']);
  });

  it('returns the registered function result to the caller', () => {
    deps.getErrorMessage = (e) => 'code:' + e.code;
    expect(deps.getErrorMessage({ code: 403 })).toBe('code:403');
  });

  it('last registration wins when a slot is wired twice', () => {
    deps.isRenderingFrames = () => 'first';
    deps.isRenderingFrames = () => 'second';
    expect(deps.isRenderingFrames()).toBe('second');
  });

  it('slots are independent of one another', () => {
    deps.giveUpTune = () => 'wired';
    expect(deps.giveUpTune()).toBe('wired');
    expect(() => deps.stopBlackWatchdog()).toThrow();
  });

  it('propagates an error thrown inside the registered function', () => {
    deps.probeChannelFormat = () => {
      throw new Error('boom');
    };
    expect(() => deps.probeChannelFormat()).toThrow('boom');
  });

  it('supports an async registered function', async () => {
    deps.loadChannel = async (c) => c.id;
    await expect(deps.loadChannel({ id: 7 })).resolves.toBe(7);
  });
});
