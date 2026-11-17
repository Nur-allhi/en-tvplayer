import { describe, it, expect, beforeEach } from 'vitest';
import { state, BOOT_IDLE_HOLD_MS } from './state.js';

// T-152a: `state` is the shared object every app slice imports. These tests
// pin the two properties that make the M5 split survivable: one stable
// identity, and mutations visible through that identity.

const SHARED_KEYS = [
  'bootTypewriterTimer',
  'bootShownAt',
  'bootTypewriterEnd',
  'currentIndex',
  'channels',
  'selectedGroup',
  'bufferingInterval',
  'bufferingActive',
  'cleanupListeners',
  'playbackStarted',
  'tuneSucceeded',
  'lastIntent',
  'tuneSeq',
  'pendingUpdate',
  'onboardFocus',
  'progressActive',
  'lastBackTime',
];

describe('app state — shared identity', () => {
  it('is a single object, not a factory result', () => {
    expect(typeof state).toBe('object');
    expect(state).toBe(state);
  });

  it('holds every shared variable', () => {
    for (const key of SHARED_KEYS) expect(state).toHaveProperty(key);
  });

  it('keeps the original initial values of the tune guard counters', () => {
    expect(state.currentIndex).toBe(0);
    expect(state.tuneSeq).toBe(0);
    expect(state.channels).toBeUndefined();
    expect(state.selectedGroup).toBeNull();
    expect(state.pendingUpdate).toBeNull();
  });

  it('keeps collections as real arrays', () => {
    expect(state.cleanupListeners).toBeInstanceOf(Array);
  });

  it('exports the boot idle hold as a single shared constant', () => {
    expect(BOOT_IDLE_HOLD_MS).toBe(1500);
  });
});

describe('app state — mutation is shared', () => {
  let saved;
  beforeEach(() => {
    saved = { channels: state.channels, currentIndex: state.currentIndex, tuneSeq: state.tuneSeq };
  });
  const restore = () => Object.assign(state, saved);

  it('propagates a write through the same reference', () => {
    const other = state;
    state.currentIndex = 42;
    expect(other.currentIndex).toBe(42);
    restore();
  });

  it('models the fast-zap staleness guard the slices rely on', () => {
    const mySeq = ++state.tuneSeq;
    expect(mySeq).toBe(state.tuneSeq);
    const later = ++state.tuneSeq;
    expect(mySeq).not.toBe(later);
    restore();
  });

  it('keeps array identity when a slice pushes into the shared cleanup list', () => {
    const original = state.cleanupListeners;
    state.cleanupListeners.push({ element: null, event: 'x', handler: () => {} });
    expect(state.cleanupListeners).toBe(original);
    state.cleanupListeners.length = 0;
  });
});
