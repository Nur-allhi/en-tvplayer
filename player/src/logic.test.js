import { describe, it, expect } from 'vitest';
import {
  filterDisplayChannels,
  findResumeIndex,
  findIntentIndex,
  segment404Decision,
  lastResortDecision,
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
