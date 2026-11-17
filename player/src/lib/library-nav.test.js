import { describe, it, expect } from 'vitest';
import { LEVELS, ADD_ROW, initialNav, current, move, select, back } from './library-nav.js';

// T-182: Back must always return one level and never leave the user in an
// empty or undefined view. The navigation stack is pure so this is testable
// without a DOM.

describe('initialNav', () => {
  it('starts at the root level', () => {
    expect(current(initialNav()).level).toBe(LEVELS.ROOT);
  });

  it('starts with one frame and no exit request', () => {
    const nav = initialNav();
    expect(nav.stack).toHaveLength(1);
    expect(nav.exit).toBe(false);
  });
});

describe('move', () => {
  it('moves down within a level', () => {
    const nav = move(initialNav(), 1, {});
    expect(current(nav).index).toBe(1);
  });

  it('clamps at the last row instead of wrapping', () => {
    let nav = initialNav();
    nav = move(nav, 9, {});
    expect(current(nav).index).toBe(2); // Movies, Series, Add source
  });

  it('clamps at zero', () => {
    let nav = initialNav();
    nav = move(nav, 1, {});
    nav = move(nav, -9, {});
    expect(current(nav).index).toBe(0);
  });

  it('does nothing when the level has no rows', () => {
    const nav = { stack: [{ level: LEVELS.LIST, index: 0 }], exit: false };
    expect(move(nav, 1, { listCount: 0 })).toBe(nav);
  });

  it('does not mutate the input', () => {
    const nav = initialNav();
    const next = move(nav, 1, {});
    expect(current(nav).index).toBe(0);
    expect(current(next).index).toBe(1);
  });
});

describe('select from root', () => {
  it('opens the movie list', () => {
    const nav = select(initialNav(), { listCount: 3 });
    expect(current(nav).level).toBe(LEVELS.LIST);
    expect(current(nav).selected).toBe('movie');
  });

  it('opens the series list when the second row is focused', () => {
    const nav = select(move(initialNav(), 1, {}), { listCount: 3 });
    expect(current(nav).selected).toBe('series');
  });

  it('does not enter an empty list', () => {
    const nav = select(initialNav(), { listCount: 0 });
    expect(current(nav).level).toBe(LEVELS.ROOT);
    expect(nav.stack).toHaveLength(1);
  });

  it('opens the Add source level from the third row', () => {
    const nav = select(move(initialNav(), 2, {}), { listCount: 0 });
    expect(current(nav).level).toBe(LEVELS.ADD);
    expect(current(nav).selected).toBe(ADD_ROW);
  });
});

describe('select from list and detail', () => {
  const atList = () => select(initialNav(), { listCount: 2 });

  it('opens the detail view for the focused item', () => {
    const nav = select(atList(), { mediaIdAt: (i) => `id-${i}` });
    expect(current(nav).level).toBe(LEVELS.DETAIL);
    expect(current(nav).selected).toBe('id-0');
  });

  it('keeps the focused index when entering detail', () => {
    const list = move(atList(), 1, { listCount: 2 });
    const nav = select(list, { mediaIdAt: (i) => `id-${i}` });
    expect(current(nav).selected).toBe('id-1');
  });

  it('opens episodes for a series with episodes', () => {
    const list = select(move(initialNav(), 1, {}), { listCount: 1 });
    const detail = select(list, { mediaIdAt: () => 's1' });
    const ctx = { selectedType: 'series', episodeCount: 4, episodeStart: 1, detailCount: 2 };
    const nav = select(move(detail, 1, ctx), ctx);
    expect(current(nav).level).toBe(LEVELS.EPISODES);
  });

  it('does not open episodes for a movie', () => {
    const detail = select(atList(), { mediaIdAt: () => 'm1' });
    const nav = select(detail, { selectedType: 'movie', episodeCount: 4 });
    expect(current(nav).level).toBe(LEVELS.DETAIL);
  });

  it('does not open an empty episode list', () => {
    const list = select(move(initialNav(), 1, {}), { listCount: 1 });
    const detail = select(list, { mediaIdAt: () => 's1' });
    const nav = select(detail, { selectedType: 'series', episodeCount: 0 });
    expect(current(nav).level).toBe(LEVELS.DETAIL);
  });

  it('moves across a Resume row in the detail view', () => {
    const detail = select(atList(), { mediaIdAt: () => 'm1' });
    const ctx = { detailCount: 3, episodeStart: 2 };
    const moved = move(detail, 1, ctx);
    expect(current(moved).index).toBe(1);
    expect(move(moved, 1, ctx) === moved).toBe(false);
  });

  it('opens episodes only from the episodes row', () => {
    const detail = select(atList(), { mediaIdAt: () => 's1' });
    const ctx = { selectedType: 'series', episodeCount: 3, detailCount: 3, episodeStart: 2 };
    expect(select(detail, ctx)).toBe(detail);
    const atEpisodes = move(move(detail, 1, ctx), 1, ctx);
    expect(current(select(atEpisodes, ctx)).level).toBe(LEVELS.EPISODES);
  });

  it('is terminal on the episode level', () => {
    const nav = { stack: [{ level: LEVELS.EPISODES, index: 0 }], exit: false };
    expect(select(nav, {})).toBe(nav);
  });
});

describe('back', () => {
  it('pops one level', () => {
    const nav = select(initialNav(), { listCount: 2 });
    const out = back(nav);
    expect(current(out).level).toBe(LEVELS.ROOT);
    expect(out.exit).toBe(false);
  });

  it('returns to the previous focused row', () => {
    let nav = select(move(initialNav(), 1, {}), { listCount: 2 });
    nav = move(nav, 1, { listCount: 2 });
    const out = back(nav);
    expect(current(out).index).toBe(1);
  });

  it('requests exit from the root instead of emptying the stack', () => {
    const out = back(initialNav());
    expect(out.exit).toBe(true);
    expect(out.stack).toHaveLength(1);
  });

  it('always leaves a valid frame', () => {
    let nav = initialNav();
    nav = select(nav, { listCount: 2 });
    nav = select(nav, { mediaIdAt: () => 'm1' });
    nav = back(back(back(nav)));
    expect(current(nav).level).toBe(LEVELS.ROOT);
    expect(nav.stack.length).toBeGreaterThan(0);
  });

  it('never strands in an empty list', () => {
    const nav = select(initialNav(), { listCount: 0 });
    const out = back(nav);
    expect(out.exit).toBe(true);
    expect(current(out).level).toBe(LEVELS.ROOT);
  });

  it('clears the exit flag when a fresh navigation starts', () => {
    expect(initialNav().exit).toBe(false);
  });
});
