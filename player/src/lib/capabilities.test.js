import { describe, it, expect } from 'vitest';
import {
  MIN_WEB_API_VERSION,
  parseWebApiVersion,
  meetsMinimumPlatform,
  selectEngine,
  engineLabel,
  missingApis,
  canObserveVideoFrames,
} from './capabilities.js';

const tizen = (over = {}) => ({
  isTizen: true,
  webApiVersion: 6.5,
  hasAbortController: true,
  hasTrimStart: true,
  hasResizeObserver: true,
  hasRequestVideoFrameCallback: true,
  hasMediaCapabilities: true,
  hasShaka: true,
  hasAvplay: true,
  ...over,
});

describe('parseWebApiVersion', () => {
  it('parses a version string', () => {
    expect(parseWebApiVersion('6.5')).toBe(6.5);
    expect(parseWebApiVersion('5.0')).toBe(5.0);
  });

  it('accepts a number unchanged', () => {
    expect(parseWebApiVersion(4.0)).toBe(4.0);
  });

  it('returns null for missing or unparseable input', () => {
    expect(parseWebApiVersion(undefined)).toBeNull();
    expect(parseWebApiVersion('')).toBeNull();
    expect(parseWebApiVersion('abc')).toBeNull();
  });
});

describe('meetsMinimumPlatform', () => {
  it('accepts Tizen 5.0 and newer', () => {
    expect(meetsMinimumPlatform(tizen({ webApiVersion: 5.0 }))).toBe(true);
    expect(meetsMinimumPlatform(tizen({ webApiVersion: 6.5 }))).toBe(true);
  });

  it('rejects Tizen 4.0 — Shaka needs Proxy, which 4.0 lacks', () => {
    expect(meetsMinimumPlatform(tizen({ webApiVersion: 4.0 }))).toBe(false);
  });

  it('rejects a Tizen build with an unreadable version', () => {
    expect(meetsMinimumPlatform(tizen({ webApiVersion: null }))).toBe(false);
  });

  it('does not block non-Tizen platforms', () => {
    expect(meetsMinimumPlatform(tizen({ isTizen: false, webApiVersion: null }))).toBe(true);
  });

  it('tolerates a missing capabilities object', () => {
    expect(meetsMinimumPlatform(null)).toBe(true);
  });

  it('exposes the floor as 5.0', () => {
    expect(MIN_WEB_API_VERSION).toBe(5.0);
  });
});

describe('selectEngine', () => {
  it('prefers Shaka when both engines exist', () => {
    expect(selectEngine(tizen())).toBe('shaka');
  });

  it('falls back to native AVPlay when Shaka is unusable', () => {
    expect(selectEngine(tizen({ hasShaka: false }))).toBe('native');
  });

  it('falls back to native when only AVPlay exists', () => {
    expect(selectEngine(tizen({ hasShaka: false, hasAvplay: true }))).toBe('native');
  });

  it('returns none when neither engine exists', () => {
    expect(selectEngine(tizen({ hasShaka: false, hasAvplay: false }))).toBe('none');
  });

  it('tolerates a missing capabilities object', () => {
    expect(selectEngine(null)).toBe('none');
  });
});

describe('engineLabel', () => {
  it('maps engines to display names', () => {
    expect(engineLabel('shaka')).toBe('Shaka');
    expect(engineLabel('native')).toBe('Native');
    expect(engineLabel('none')).toBe('None');
  });
});

describe('missingApis', () => {
  it('reports nothing on a fully capable platform', () => {
    expect(missingApis(tizen())).toEqual([]);
  });

  it('reports each missing API by name', () => {
    expect(missingApis(tizen({ hasAbortController: false, hasTrimStart: false, hasResizeObserver: false }))).toEqual([
      'AbortController',
      'trimStart',
      'ResizeObserver',
    ]);
  });

  it('reports only the APIs that are actually missing', () => {
    expect(missingApis(tizen({ hasTrimStart: false }))).toEqual(['trimStart']);
  });

  it('tolerates a missing capabilities object', () => {
    expect(missingApis(null)).toEqual([]);
  });
});

describe('canObserveVideoFrames', () => {
  it('is true when requestVideoFrameCallback exists', () => {
    expect(canObserveVideoFrames(tizen())).toBe(true);
  });

  it('is false when only getVideoPlaybackQuality is available', () => {
    expect(canObserveVideoFrames(tizen({ hasRequestVideoFrameCallback: false }))).toBe(false);
  });

  it('is false for a missing capabilities object', () => {
    expect(canObserveVideoFrames(null)).toBe(false);
  });
});
