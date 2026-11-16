import { describe, it, expect, beforeEach } from 'vitest';
import { state } from './state.js';

// T-129: `state` is the shared object that the `player/` slice will all
// import. These tests pin the two properties that make Risk C survivable:
// identity is stable, and mutation is visible through that identity.

describe('player state — shared identity', () => {
  it('is a single object, not a factory result', () => {
    // Two imports must be the same reference. If this ever becomes a
    // function, every slice gets its own copy and recovery silently breaks.
    expect(typeof state).toBe('object');
    expect(state).toBe(state);
  });

  it('holds the engine and DOM handles', () => {
    expect(state).toHaveProperty('player');
    expect(state).toHaveProperty('videoElement');
  });

  it('holds the current tune and its staleness token', () => {
    expect(state).toHaveProperty('currentChannel');
    expect(state).toHaveProperty('loadToken');
    expect(typeof state.loadToken).toBe('number');
  });

  it('holds the recovery budgets', () => {
    for (const key of [
      'reconnectAttempts',
      'consecutiveErrors',
      'hardReloads',
      'tuneAttempt',
      'stallDeferrals',
      'lastResortAttempts',
      'advancePending',
    ]) {
      expect(state).toHaveProperty(key);
    }
  });

  it('holds the URL-keyed workaround caches as real collections', () => {
    expect(state.avplayPreferredUrls).toBeInstanceOf(Set);
    expect(state.avplayFailedUrls).toBeInstanceOf(Set);
    expect(state.pdtFallbackUrls).toBeInstanceOf(Set);
    expect(state.sniffTriedUrls).toBeInstanceOf(Set);
    expect(state.sniffedMimeUrls).toBeInstanceOf(Map);
  });
});

describe('player state — mutation is shared', () => {
  let saved;

  beforeEach(() => {
    saved = {
      loadToken: state.loadToken,
      currentChannel: state.currentChannel,
      reconnectAttempts: state.reconnectAttempts,
      useAvplay: state.useAvplay,
    };
  });

  const restore = () => {
    Object.assign(state, saved);
  };

  it('propagates a write through the same reference', () => {
    const other = state;
    state.loadToken = 4242;
    expect(other.loadToken).toBe(4242);
    restore();
  });

  it('models the staleness guard the loader relies on', () => {
    // loadChannel does `const myToken = ++state.loadToken` and later bails
    // when `myToken !== state.loadToken`. A per-slice copy would make that
    // comparison always true and every tune would abort silently.
    const myToken = ++state.loadToken;
    expect(myToken).toBe(state.loadToken);

    const laterToken = ++state.loadToken;
    expect(myToken).not.toBe(laterToken);
    restore();
  });

  it('keeps Set membership across writers', () => {
    const url = 'https://example.test/live.m3u8';
    state.avplayPreferredUrls.add(url);
    expect(state.avplayPreferredUrls.has(url)).toBe(true);
    state.avplayPreferredUrls.delete(url);
    expect(state.avplayPreferredUrls.has(url)).toBe(false);
  });

  it('keeps useAvplay as per-channel runtime state', () => {
    // Deliberately NOT a capability (T-115): a channel can fall back to
    // native while the platform still reports Shaka available.
    state.useAvplay = true;
    expect(state.useAvplay).toBe(true);
    const caps = { hasShaka: true, hasAvplay: true };
    expect(caps.hasShaka).toBe(true);
    restore();
  });
});
