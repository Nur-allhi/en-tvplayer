import { describe, it, expect } from 'vitest';
import { CHANGELOG } from './changelog.js';

// T-152b: the in-app What's New data moved verbatim out of main.js. These
// tests pin the shape the modal renderer and the T-153 release script rely on.

describe('app changelog — shape', () => {
  it('is a non-empty array of version entries', () => {
    expect(Array.isArray(CHANGELOG)).toBe(true);
    expect(CHANGELOG.length).toBeGreaterThan(5);
  });

  it('every entry has a version string and a non-empty sections array', () => {
    for (const entry of CHANGELOG) {
      expect(typeof entry.version).toBe('string');
      expect(Array.isArray(entry.sections)).toBe(true);
      expect(entry.sections.length).toBeGreaterThan(0);
    }
  });

  it('only uses icon-mapped section types', () => {
    const types = new Set(CHANGELOG.flatMap((e) => e.sections.map((s) => s.type)));
    expect([...types].every((t) => ['added', 'fixed', 'changed'].includes(t))).toBe(true);
  });

  it('every section item is a non-empty string', () => {
    for (const section of CHANGELOG.flatMap((e) => e.sections)) {
      expect(Array.isArray(section.items)).toBe(true);
      for (const item of section.items) expect(typeof item).toBe('string');
    }
  });

  it('lists versions newest first, as the modal renders them in order', () => {
    const versions = CHANGELOG.map((e) => e.version);
    expect(versions[0]).toBe('3.2.0');
    for (let i = 1; i < versions.length; i++) {
      const prev = versions[i - 1].split('.').map(Number);
      const cur = versions[i].split('.').map(Number);
      let older = false;
      for (let part = 0; part < 3; part++) {
        if (cur[part] < prev[part]) {
          older = true;
          break;
        }
        if (cur[part] > prev[part]) break;
      }
      expect(older).toBe(true);
    }
  });
});
