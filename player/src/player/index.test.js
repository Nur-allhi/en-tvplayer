import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// T-123: player/index.js is the only entry. Importing it at runtime pulls in
// Shaka (which needs `self`, absent in node tests), so this test checks the
// wiring statically instead. A slot left unwired throws at call time — a
// runtime-only playback failure the build cannot catch.

const dir = new URL('./', import.meta.url);
const read = (f) => readFileSync(new URL(f, dir), 'utf8');

const SLOTS = [...read('deps.js').matchAll(/^\s{2}([A-Za-z0-9_]+): unwired/gm)].map((m) => m[1]);
const SLICE_FILES = [
  'dom.js',
  'watchdog.js',
  'recover.js',
  'native.js',
  'probe.js',
  'load.js',
  'init.js',
  'stream.js',
  'controls.js',
];

describe('player/index.js hub', () => {
  it('wires every deps slot in exactly one slice', () => {
    const wired = new Map();
    for (const file of SLICE_FILES) {
      const block = read(file).match(/Object\.assign\(deps,\s*\{([\s\S]*?)\}\)/);
      if (!block) continue;
      for (const m of block[1].matchAll(/^\s*(\w+),?$/gm)) {
        if (SLOTS.includes(m[1])) {
          expect(wired.has(m[1])).toBe(false); // double wiring is a bug
          wired.set(m[1], file);
        }
      }
    }
    expect([...wired.keys()].sort()).toEqual([...SLOTS].sort());
  });

  it('makes every wiring slice reachable from the hub', () => {
    const hub = read('index.js');
    for (const file of SLICE_FILES) {
      const name = file.replace('.js', '');
      expect(hub).toMatch(new RegExp(`['"]\\./${name}\\.js['"]`));
    }
  });

  it('exports exactly the 24-name API', () => {
    const hub = read('index.js');
    const names = new Set();
    for (const m of hub.matchAll(/^export\s*\{([^}]+)\}/gm)) {
      for (let n of m[1].split(',')) {
        n = n
          .trim()
          .split(/\s+as\s+/)
          .pop()
          .trim();
        if (n) names.add(n);
      }
    }
    // The hub re-exports via `export *`; resolve those slices to count names.
    for (const m of hub.matchAll(/^export\s*\*\s*from\s*['"]\.\/([^'"]+)\.js['"]/gm)) {
      const src = read(m[1] + '.js');
      for (const n of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let)\s+(\w+)/gm)) names.add(n[1]);
    }
    expect(names.size).toBe(24);
    expect(names.has('loadChannel')).toBe(true);
    expect(names.has('isNativeAvailable')).toBe(true);
  });
});
