import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { deps } from './deps.js';
import { state } from './state.js';
import { handleLoadError } from './load-error.js';

// T-127: the load-error branch was extracted from loadChannel only to satisfy
// the 300-LOC guard. These tests pin the branch order that used to be implicit
// in the catch block — a 401, a PDT crash and a generic failure must not be
// reordered by a future slice move.

const SLOT_NAMES = [
  'logEvent',
  'showError',
  'showLoading',
  'scheduleReconnect',
  'initPlayer',
  'loadChannel',
  'probeChannelFormat',
  'getErrorMessage',
  'isProxyEnabledFor',
  'notifyTuneAttempt',
  'showTuneElapsed',
  'tryResumeVideo',
  'hideError',
  'loadViaAvplay',
  'switchToAvplay',
  'shouldTryNative',
  'destroyPlayer',
];

const saved = {};
const savedState = {};
const STATE_KEYS = [
  'loadToken',
  'currentChannel',
  'loadingTimeout',
  'initialLoadPending',
  'videoErrorCount',
  'reconnectAttempts',
  'sniffTriedUrls',
  'sniffedMimeUrls',
  'pdtFallbackUrls',
  'useAvplay',
  'lastResortAttempts',
];

beforeEach(() => {
  for (const n of SLOT_NAMES) saved[n] = deps[n];
  for (const k of STATE_KEYS) savedState[k] = state[k];
  deps.logEvent = () => {};
  deps.showError = () => {};
  deps.showLoading = () => {};
  deps.scheduleReconnect = () => {};
  deps.initPlayer = async () => true;
  deps.loadChannel = () => {};
  deps.probeChannelFormat = async () => null;
  deps.getErrorMessage = (e) => 'msg:' + (e && e.code);
  deps.destroyPlayer = async () => true;

  // The catch starts by clearing the slate; seed a current tune so the
  // generation guard passes and the branch logic is what is under test.
  state.loadToken = 1;
  state.currentChannel = { name: 'Ch', url: 'https://example.test/x.m3u8' };
  state.loadingTimeout = null;
  state.initialLoadPending = false;
  state.videoErrorCount = 0;
  state.reconnectAttempts = 0;
  state.sniffTriedUrls = new Set();
  state.sniffedMimeUrls = new Map();
  state.pdtFallbackUrls = new Set();
});

afterEach(() => {
  for (const n of SLOT_NAMES) deps[n] = saved[n];
  for (const k of STATE_KEYS) state[k] = savedState[k];
});

describe('handleLoadError — branch order', () => {
  it('returns false for an aborted operation (7000) without reporting', async () => {
    const calls = [];
    deps.logEvent = () => calls.push('log');
    deps.showError = () => calls.push('error');
    expect(await handleLoadError({ code: 7000 }, 1, state.currentChannel)).toBe(false);
    expect(calls).toEqual([]);
  });

  it('schedules a reconnect for a recoverable error', async () => {
    let scheduled = 0;
    deps.scheduleReconnect = () => {
      scheduled++;
    };
    // 3018 is recoverable per recovery.js.
    const r = await handleLoadError({ code: 3018 }, 1, state.currentChannel);
    expect(r).toBe(false);
    expect(scheduled).toBe(1);
  });

  it('reports an unrecoverable error through both log and the UI', async () => {
    const calls = [];
    deps.logEvent = () => calls.push('log');
    deps.showError = () => calls.push('error');
    expect(await handleLoadError({ code: 1000 }, 1, state.currentChannel)).toBe(false);
    expect(calls).toContain('log');
    expect(calls).toContain('error');
  });

  it('bails out when a newer tune superseded this one', async () => {
    let scheduled = 0;
    deps.scheduleReconnect = () => {
      scheduled++;
    };
    expect(await handleLoadError({ code: 3018 }, 1, state.currentChannel)).toBe(false);
    state.loadToken = 2;
    expect(await handleLoadError({ code: 3018 }, 1, state.currentChannel)).toBe(false);
    expect(scheduled).toBe(1); // only the current tune scheduled
  });
});
