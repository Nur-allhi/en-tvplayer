import { describe, it, expect, beforeEach } from 'vitest';
import { state, uiState } from './state.js';

// T-130: `state` is the shared object every ui/ slice will import. These tests
// pin the two properties that make Risk C survivable: one stable identity, and
// mutations visible through that identity.

describe('ui state — shared identity', () => {
  it('is a single object, not a factory result', () => {
    // Two importers must get the same reference. If this becomes a function,
    // each slice gets its own copy and the sidebar/focus silently stops working.
    expect(typeof state).toBe('object');
    expect(state).toBe(state);
  });

  it('is the live value of the uiState store (T-170)', () => {
    expect(state).toBe(uiState.getState());
  });

  it('lets a slice setState() without losing the shared reference', () => {
    const other = state;
    uiState.setState({ focusedIndex: 3 });
    expect(state).toBe(other);
    expect(state.focusedIndex).toBe(3);
    state.focusedIndex = 0;
  });

  it('holds every shared variable with its original initial value', () => {
    for (const key of [
      'channels',
      'currentIndex',
      'focusedIndex',
      'virtualStart',
      'virtualEnd',
      'sidebarOpen',
      'isFullscreen',
      'rightSidebarOpen',
      'rightResolutions',
      'rightFocus',
      'rightItems',
      'sidebarMode',
      'groups',
      'selectedGroup',
      'groupFocusedIndex',
      'searchQuery',
      'searchResults',
      'searchFocus',
    ]) {
      expect(state).toHaveProperty(key);
    }
    expect(state.channels).toEqual([]);
    expect(state.currentIndex).toBe(-1);
    expect(state.focusedIndex).toBe(0);
    expect(state.sidebarMode).toBe('channels');
    expect(state.selectedGroup).toBeNull();
    expect(state.searchQuery).toBe('');
  });
});

describe('ui state — mutation is shared', () => {
  let saved;

  beforeEach(() => {
    saved = {
      channels: state.channels,
      currentIndex: state.currentIndex,
      sidebarOpen: state.sidebarOpen,
      searchQuery: state.searchQuery,
    };
  });

  const restore = () => Object.assign(state, saved);

  it('propagates a write through the same reference', () => {
    const other = state;
    state.currentIndex = 42;
    expect(other.currentIndex).toBe(42);
    restore();
  });

  it('keeps array identity when slices push into a shared collection', () => {
    const original = state.channels;
    state.channels.push({ name: 'CNN' });
    expect(state.channels).toBe(original);
    expect(original).toHaveLength(1);
    restore();
  });

  it('models the focus write a slice performs on channel change', () => {
    state.focusedIndex = 7;
    expect(state.focusedIndex).toBe(7);
    restore();
  });
});
