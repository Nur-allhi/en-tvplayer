// Pure Movies/Series browser navigation (T-182). A stack of frames, one per
// level. Back pops exactly one frame; from the root it asks the caller to
// leave the library. No DOM so the "never strands" rule is unit-testable.

export const LEVELS = {
  ROOT: 'root',
  LIST: 'list',
  DETAIL: 'detail',
  EPISODES: 'episodes',
};

const ROOT_ROWS = 2; // Movies, Series

export function initialNav() {
  return { stack: [{ level: LEVELS.ROOT, index: 0, selected: null }], exit: false };
}

export function current(nav) {
  return nav.stack[nav.stack.length - 1];
}

const rowCount = (frame, ctx) => {
  switch (frame.level) {
    case LEVELS.ROOT:
      return ROOT_ROWS;
    case LEVELS.LIST:
      return ctx.listCount || 0;
    case LEVELS.DETAIL:
      return 1;
    case LEVELS.EPISODES:
      return ctx.episodeCount || 0;
    default:
      return 0;
  }
};

const replaceTop = (nav, frame) => ({
  ...nav,
  stack: [...nav.stack.slice(0, -1), frame],
});

const push = (nav, frame) => ({ ...nav, stack: [...nav.stack, frame] });

// Clamp at both ends: a 10-foot UI should stop at the edge, not wrap.
export function move(nav, delta, ctx = {}) {
  const frame = current(nav);
  const count = rowCount(frame, ctx);
  if (count <= 0) return nav;
  const index = Math.max(0, Math.min(count - 1, frame.index + delta));
  return index === frame.index ? nav : replaceTop(nav, { ...frame, index });
}

export function select(nav, ctx = {}) {
  const frame = current(nav);
  switch (frame.level) {
    case LEVELS.ROOT:
      if (!ctx.listCount) return nav;
      return push(nav, {
        level: LEVELS.LIST,
        index: 0,
        selected: frame.index === 0 ? 'movie' : 'series',
      });
    case LEVELS.LIST: {
      const id = ctx.mediaIdAt ? ctx.mediaIdAt(frame.index) : null;
      if (!id) return nav;
      return push(nav, { level: LEVELS.DETAIL, index: 0, selected: id });
    }
    case LEVELS.DETAIL:
      if (ctx.selectedType !== 'series' || !ctx.episodeCount) return nav;
      return push(nav, { level: LEVELS.EPISODES, index: 0, selected: frame.selected });
    default:
      return nav;
  }
}

export function back(nav) {
  if (nav.stack.length > 1) {
    return { stack: nav.stack.slice(0, -1), exit: false };
  }
  return { ...nav, exit: true };
}
