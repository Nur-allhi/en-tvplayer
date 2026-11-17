import { describe, it, expect } from 'vitest';
import { state, NAV_ITEMS, MAX_PLAYLISTS } from './state.js';
import { deps } from './deps.js';

// T-141: the settings split moved render + playlist CRUD into three slices.
// These tests pin the shared contracts: one state object, the deps surface,
// and the constants the card renderers read.

describe('settings shared constants', () => {
  it('keeps the three nav items in order', () => {
    expect(NAV_ITEMS.map((n) => n.id)).toEqual(['source', 'playback', 'about']);
  });

  it('keeps the playlist cap at 3', () => {
    expect(MAX_PLAYLISTS).toBe(3);
  });
});

describe('settings state after T-141', () => {
  it('still exposes the focus and form fields', () => {
    for (const k of [
      'activeSection',
      'focusIdx',
      'focusOrder',
      'addMode',
      'editMode',
      'addType',
      'editType',
      'editIndex',
      'container',
      'onRender',
    ]) {
      expect(k in state).toBe(true);
    }
  });
});

describe('settings deps after T-141', () => {
  it('has a function in every slot', () => {
    for (const fn of Object.values(deps)) expect(typeof fn).toBe('function');
  });

  it('fails loudly when unwired', () => {
    expect(() => deps.handleFetch()).toThrow(/before it was wired/);
  });
});
