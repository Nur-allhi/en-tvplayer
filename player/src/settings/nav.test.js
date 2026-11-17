import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { state } from './state.js';
import { deps } from './deps.js';

// T-140: the settings split is a Risk C move — the navigation slices and the
// hub must share ONE state object and wire EVERY deps slot. A runtime import
// of settings.js pulls in DOM-coupled modules, so these checks are static,
// like the player/index.js hub tests.

const dir = new URL('./', import.meta.url);
const read = (f) => readFileSync(new URL(f, dir), 'utf8');

const SLOT_NAMES = [
  'render',
  'saveAddPlaylist',
  'saveEditPlaylist',
  'setFormType',
  'testXtreamLogin',
  'handleFetch',
  'groupNames',
  'moveSettingsFocus',
  'applyFocus',
  'buildFocusOrder',
  'clearFocus',
  'copyDiagnostics',
  'importMediaSource',
];

describe('settings state', () => {
  it('is one shared mutable object', () => {
    expect(typeof state).toBe('object');
    expect(state).toBe(state);
  });

  it('starts with the documented defaults', () => {
    expect(state.activeSection).toBe('source');
    expect(state.focusIdx).toBe(0);
    expect(state.focusOrder).toEqual([]);
    expect(state.addType).toBe('m3u');
    expect(state.editType).toBe('m3u');
    expect(state.editIndex).toBe(-1);
    expect(state.addMode).toBe(false);
    expect(state.editMode).toBe(false);
  });
});

describe('settings deps', () => {
  it('has a function in every slot', () => {
    for (const name of SLOT_NAMES) expect(typeof deps[name]).toBe('function');
  });

  it('fails loudly when an unwired slot is called', () => {
    expect(() => deps.render()).toThrow(/before it was wired/);
  });

  it('exposes exactly the documented slots', () => {
    expect(Object.keys(deps).sort()).toEqual([...SLOT_NAMES].sort());
  });
});

describe('settings nav wiring', () => {
  it('wires every slot across the slices that own them', () => {
    const names = (block) => [...block.matchAll(/(\w+)\s*,?/g)].map((m) => m[1]);
    const wired = new Set();
    for (const file of ['lifecycle.js', 'nav.js', 'about.js']) {
      const block = read(file).match(/Object\.assign\(deps,\s*\{([\s\S]*?)\}\)/);
      expect(block).not.toBeNull();
      for (const name of names(block[1])) wired.add(name);
    }
    for (const name of SLOT_NAMES) expect(wired.has(name)).toBe(true);
  });

  it('routes the BUG-011/012 form fields through deps', () => {
    // OK in pl-add-name saves; OK in pl-add-url moves back to name; same for edit.
    const select = read('select.js');
    expect(select).toMatch(/'pl-add-name'\) \{\s*deps\.saveAddPlaylist\(\)/);
    expect(select).toMatch(/'pl-add-url'\) \{\s*deps\.moveSettingsFocus\('pl-add-name'\)/);
    expect(select).toMatch(/'pl-edit-name'\) \{\s*deps\.saveEditPlaylist\(\)/);
    expect(select).toMatch(/'pl-edit-url'\) \{\s*deps\.moveSettingsFocus\('pl-edit-name'\)/);
  });
});
