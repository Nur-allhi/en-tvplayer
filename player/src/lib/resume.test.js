import { describe, it, expect } from 'vitest';
import {
  clampPosition,
  formatTime,
  isResumable,
  groupEpisodesBySeason,
  resumeDecision,
  withinTolerance,
} from './resume.js';

// T-183: resume persistence is pure and testable here. Restoring it in the
// player belongs to T-185 and needs a TV, so only the ±5s contract is pinned.

describe('clampPosition', () => {
  it('keeps a valid position', () => {
    expect(clampPosition(42, 100)).toBe(42);
  });

  it('clamps to duration', () => {
    expect(clampPosition(120, 90)).toBe(90);
  });

  it('floors negative and invalid values at zero', () => {
    expect(clampPosition(-5, 100)).toBe(0);
    expect(clampPosition(NaN, 100)).toBe(0);
  });

  it('does not clamp when the duration is unknown', () => {
    expect(clampPosition(42, undefined)).toBe(42);
  });
});

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(75)).toBe('1:15');
  });

  it('formats hours as h:mm:ss', () => {
    expect(formatTime(3661)).toBe('1:01:01');
  });

  it('pads zero and never goes negative', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(-3)).toBe('0:00');
  });

  it('floors fractional seconds', () => {
    expect(formatTime(59.9)).toBe('0:59');
  });
});

describe('isResumable', () => {
  it('accepts a position past the five-second threshold', () => {
    expect(isResumable(30, 100)).toBe(true);
  });

  it('rejects a position near the start', () => {
    expect(isResumable(4, 100)).toBe(false);
  });

  it('rejects a position near the end', () => {
    expect(isResumable(98, 100)).toBe(false);
  });

  it('rejects missing or invalid positions', () => {
    expect(isResumable(null, 100)).toBe(false);
    expect(isResumable(undefined, 100)).toBe(false);
    expect(isResumable(NaN, 100)).toBe(false);
  });

  it('accepts any positive position when duration is unknown', () => {
    expect(isResumable(30, undefined)).toBe(true);
  });
});

describe('resumeDecision', () => {
  it('offers resume with the saved position', () => {
    expect(resumeDecision(30, 100)).toEqual({ label: 'Resume at 0:30', at: 30 });
  });

  it('falls back to play from start', () => {
    expect(resumeDecision(2, 100)).toEqual({ label: 'Play from start', at: 0 });
  });

  it('falls back to start when the saved position is past the end', () => {
    expect(resumeDecision(120, 100)).toEqual({ label: 'Play from start', at: 0 });
  });
});

describe('withinTolerance', () => {
  it('accepts positions inside the five-second tolerance', () => {
    expect(withinTolerance(100, 104)).toBe(true);
    expect(withinTolerance(100, 96)).toBe(true);
  });

  it('rejects positions outside the tolerance', () => {
    expect(withinTolerance(100, 106)).toBe(false);
  });

  it('uses an exact boundary as inside', () => {
    expect(withinTolerance(100, 105)).toBe(true);
  });
});

describe('groupEpisodesBySeason', () => {
  const episodes = [
    { season: 2, number: 1, title: 'b' },
    { season: 1, number: 2, title: 'a2' },
    { season: 1, number: 1, title: 'a1' },
  ];

  it('groups by ascending season', () => {
    expect(groupEpisodesBySeason(episodes).map(([season]) => season)).toEqual([1, 2]);
  });

  it('sorts episodes inside each season by number', () => {
    const first = groupEpisodesBySeason(episodes)[0][1];
    expect(first.map((ep) => ep.number)).toEqual([1, 2]);
  });

  it('returns an empty array for no episodes', () => {
    expect(groupEpisodesBySeason([])).toEqual([]);
  });
});
