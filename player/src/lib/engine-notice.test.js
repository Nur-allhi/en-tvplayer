import { describe, it, expect } from 'vitest';
import { fallbackNotice, needsNotice } from './engine-notice.js';

describe('fallbackNotice', () => {
  it('uses Shaka with no notice when Shaka is usable', () => {
    expect(fallbackNotice(true, true)).toEqual({ mode: 'shaka', notice: null });
  });

  it('uses Shaka with no notice even without AVPlay', () => {
    expect(fallbackNotice(true, false)).toEqual({ mode: 'shaka', notice: null });
  });

  it('uses native mode with a DRM notice when Shaka fails and AVPlay exists', () => {
    const r = fallbackNotice(false, true);
    expect(r.mode).toBe('native');
    expect(r.notice).toMatch(/DRM/i);
    expect(r.notice).toMatch(/unavailable/i);
  });

  it('uses none mode with a plain message when neither engine works', () => {
    const r = fallbackNotice(false, false);
    expect(r.mode).toBe('none');
    expect(r.notice).toMatch(/cannot play/i);
  });

  it('never returns an empty notice for a failing mode', () => {
    for (const avail of [true, false]) {
      const r = fallbackNotice(false, avail);
      expect(typeof r.notice).toBe('string');
      expect(r.notice.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic', () => {
    expect(fallbackNotice(false, true)).toEqual(fallbackNotice(false, true));
  });
});

describe('needsNotice', () => {
  it('is false for shaka', () => {
    expect(needsNotice('shaka')).toBe(false);
  });

  it('is true for native and none', () => {
    expect(needsNotice('native')).toBe(true);
    expect(needsNotice('none')).toBe(true);
  });

  it('is false for an unknown mode', () => {
    expect(needsNotice('other')).toBe(false);
  });
});
