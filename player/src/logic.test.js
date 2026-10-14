import { describe, it, expect } from 'vitest';
import {
  filterDisplayChannels,
  findResumeIndex,
  findIntentIndex,
  segment404Decision,
  lastResortDecision,
  tokenRecoveryDecision,
  forbiddenRetryDelay,
  tuneCountersReset,
  isStalePlayerEvent,
  shouldIgnoreVideoError,
  hardReloadDecision,
  tuneSuperseded,
  shouldResumePlayback,
  isNetworkActive,
} from './logic.js';

const CHANNELS = [
  { name: 'BBC', url: 'https://x.example.com/bbc', group: 'News' },
  { name: 'ESPN', url: 'https://x.example.com/espn', group: 'Sports' },
  { name: 'Local', url: 'https://x.example.com/local', group: null },
];

describe('filterDisplayChannels', () => {
  it('returns everything when nothing is hidden or selected', () => {
    expect(filterDisplayChannels(CHANNELS, [], null)).toHaveLength(3);
    expect(filterDisplayChannels(CHANNELS, [], 'all')).toHaveLength(3);
  });

  it('removes hidden groups, treating missing group as Ungrouped', () => {
    const visible = filterDisplayChannels(CHANNELS, ['Sports', 'Ungrouped'], null);
    expect(visible.map((c) => c.name)).toEqual(['BBC']);
  });

  it('filters to the selected group after hiding', () => {
    expect(filterDisplayChannels(CHANNELS, [], 'News').map((c) => c.name)).toEqual(['BBC']);
    expect(filterDisplayChannels(CHANNELS, ['News'], 'News')).toEqual([]);
  });

  it('is null-safe', () => {
    expect(filterDisplayChannels(null, null, null)).toEqual([]);
  });
});

describe('findResumeIndex', () => {
  it('finds the saved URL even after a re-sort', () => {
    const resorted = [CHANNELS[2], CHANNELS[0], CHANNELS[1]];
    expect(findResumeIndex(resorted, 'https://x.example.com/espn', [])).toBe(2);
  });

  it('returns -1 when nothing saved, gone, or hidden', () => {
    expect(findResumeIndex(CHANNELS, null, [])).toBe(-1);
    expect(findResumeIndex(CHANNELS, 'https://x.example.com/gone', [])).toBe(-1);
    expect(findResumeIndex(CHANNELS, 'https://x.example.com/espn', ['Sports'])).toBe(-1);
  });
});

describe('findIntentIndex', () => {
  it('matches by name + group (URLs rotate, names survive)', () => {
    const fresh = [{ name: 'ESPN', url: 'https://x.example.com/espn?tok=NEW', group: 'Sports' }];
    expect(findIntentIndex(fresh, { name: 'ESPN', group: 'Sports' })).toBe(0);
    expect(findIntentIndex(fresh, { name: 'ESPN', group: 'News' })).toBe(-1);
    expect(findIntentIndex(fresh, null)).toBe(-1);
  });
});

describe('segment404Decision', () => {
  const URL = 'https://x.example.com/live';

  it('grants 3 reloads per URL inside the window, then condemns', () => {
    let state = null;
    for (let i = 1; i <= 3; i++) {
      const d = segment404Decision(state, URL, 1000 * i);
      expect(d.retry).toBe(true);
      expect(d.state.attempts).toBe(i);
      state = d.state;
    }
    expect(segment404Decision(state, URL, 4000).retry).toBe(false);
  });

  it('resets for a new URL or after the 5-minute window', () => {
    const used = { url: URL, attempts: 3, lastAt: 0 };
    expect(segment404Decision(used, 'https://x.example.com/other', 1000).retry).toBe(true);
    expect(segment404Decision(used, URL, 10 * 60 * 1000).retry).toBe(true);
  });
});

describe('lastResortDecision', () => {
  it('retries 3 times, then advances', () => {
    expect([1, 2, 3].map(lastResortDecision)).toEqual(['retry', 'retry', 'retry']);
    expect(lastResortDecision(4)).toBe('advance');
  });
});

describe('tokenRecoveryDecision', () => {
  // Same dead token URL reloaded forever 403s: two fast grace reloads,
  // then a playlist refetch for a fresh token, then give up the channel.
  it('reloads twice, refetches the playlist once, then advances', () => {
    expect([1, 2].map(tokenRecoveryDecision)).toEqual(['reload', 'reload']);
    expect(tokenRecoveryDecision(3)).toBe('refresh');
    expect(tokenRecoveryDecision(4)).toBe('advance');
    expect(tokenRecoveryDecision(99)).toBe('advance');
  });
});

describe('forbiddenRetryDelay', () => {
  it('backs off exponentially with a cap instead of hammering', () => {
    expect(forbiddenRetryDelay(1)).toBe(4000);
    expect(forbiddenRetryDelay(2)).toBe(8000);
    expect(forbiddenRetryDelay(3)).toBe(16000);
    expect(forbiddenRetryDelay(10)).toBe(16000);
  });
});

describe('tuneCountersReset', () => {
  // #16: a dead channel's error/retry counters must not poison the next tune.
  it('resets counters when switching to a different channel URL', () => {
    expect(tuneCountersReset('https://x.example.com/dead', 'https://x.example.com/good')).toBe(true);
  });

  it('keeps budgets on same-URL reload (mid-playback token refresh)', () => {
    expect(tuneCountersReset('https://x.example.com/live', 'https://x.example.com/live')).toBe(false);
  });

  it('resets on first tune (no previous URL)', () => {
    expect(tuneCountersReset(null, 'https://x.example.com/live')).toBe(true);
  });
});

describe('isStalePlayerEvent', () => {
  // #16: events from a destroy-hung previous player must not act on the new tune.
  it('ignores events from an older player generation', () => {
    expect(isStalePlayerEvent(4, 5)).toBe(true);
  });

  it('accepts events from the current generation', () => {
    expect(isStalePlayerEvent(5, 5)).toBe(false);
  });
});

describe('shouldIgnoreVideoError', () => {
  // #16: our own teardown (src='' + load()) fires code 4 "Empty src" —
  // that is not a real channel failure.
  it('ignores empty-src errors from teardown clearing', () => {
    expect(
      shouldIgnoreVideoError({ code: 4, message: 'MEDIA_ELEMENT_ERROR: Empty src attribute', srcEmpty: true }),
    ).toBe(true);
  });

  it('counts genuine decode/network errors', () => {
    expect(shouldIgnoreVideoError({ code: 3, message: 'decode error', srcEmpty: false })).toBe(false);
    expect(shouldIgnoreVideoError({ code: 4, message: 'not supported', srcEmpty: false })).toBe(false);
  });
});

describe('hardReloadDecision', () => {
  // User report: endless destroy/reload loop never stops buffering and the
  // TV eventually kills the app. Hard reloads get a per-tune budget of 3,
  // then the tune is given up with a terminal message.
  it('allows 3 hard reloads per tune, then gives up', () => {
    expect([0, 1, 2].map(hardReloadDecision)).toEqual(['reload', 'reload', 'reload']);
    expect(hardReloadDecision(3)).toBe('giveup');
    expect(hardReloadDecision(99)).toBe('giveup');
  });
});

describe('tuneSuperseded', () => {
  // TV report: fast zapping (15 → 20) plays nothing while one-by-one works.
  // Intermediate tunes of a burst must yield to the latest press.
  it('skips burst tunes superseded by a newer press', () => {
    expect(tuneSuperseded(7, 9)).toBe(true);
    expect(tuneSuperseded(8, 9)).toBe(true);
  });

  it('runs the latest tune and lone tunes', () => {
    expect(tuneSuperseded(9, 9)).toBe(false);
  });
});

describe('shouldResumePlayback', () => {
  // TV report: buffering toast gone, channel name centered, nothing playing.
  // A stale teardown paused the video behind the winner's back — resume it.
  it('resumes an unexpected pause', () => {
    expect(shouldResumePlayback({ paused: true, ended: false, userPaused: false })).toBe(true);
  });

  it('leaves user pauses, ended streams, and playing video alone', () => {
    expect(shouldResumePlayback({ paused: true, ended: false, userPaused: true })).toBe(false);
    expect(shouldResumePlayback({ paused: true, ended: true, userPaused: false })).toBe(false);
    expect(shouldResumePlayback({ paused: false, ended: false, userPaused: false })).toBe(false);
  });
});

describe('isNetworkActive', () => {
  // Flaky-relay report: frozen picture while segments still flow is slow,
  // not stuck — the watchdog must wait it out instead of restarting the tune.
  it('treats recent Shaka request/response activity as alive', () => {
    expect(isNetworkActive(9000, 10000)).toBe(true);
    expect(isNetworkActive(0, 10000)).toBe(false);
    expect(isNetworkActive(0, 10000, 15000)).toBe(true);
  });
});
