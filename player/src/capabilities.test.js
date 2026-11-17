import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectCapabilities,
  capabilities,
  resetCapabilities,
  currentEngine,
  probeTvModel,
  getTvModel,
  resetTvModel,
} from './capabilities.js';

// A minimal fake window. detectCapabilities() takes an explicit window so it
// can be tested without jsdom (the project runs vitest in a node env).
function fakeWindow(over = {}) {
  return {
    tizen: {
      webAPIVersion: '6.5',
      tvinputdevice: { registerKey: function () {} },
      application: { getCurrentApplication: function () {} },
    },
    AbortController: function () {},
    ResizeObserver: function () {},
    HTMLVideoElement: { prototype: { requestVideoFrameCallback: function () {} } },
    navigator: { mediaCapabilities: {} },
    shaka: {},
    webapis: { avplay: {} },
    ...over,
  };
}

describe('detectCapabilities', () => {
  beforeEach(() => resetCapabilities());

  it('reads a fully capable TV', () => {
    const caps = detectCapabilities(fakeWindow());
    expect(caps).toMatchObject({
      isTizen: true,
      hasTvInputDevice: true,
      hasApplicationControl: true,
      webApiVersion: 6.5,
      hasAbortController: true,
      hasTrimStart: true,
      hasResizeObserver: true,
      hasRequestVideoFrameCallback: true,
      hasMediaCapabilities: true,
      hasShaka: true,
      hasAvplay: true,
    });
  });

  it('detects a Tizen build without the remote-key API', () => {
    const w = fakeWindow({ tizen: { webAPIVersion: '6.5', application: {} } });
    expect(detectCapabilities(w)).toMatchObject({ isTizen: true, hasTvInputDevice: false });
  });

  it('detects a Tizen build without application control', () => {
    const w = fakeWindow({ tizen: { webAPIVersion: '6.5', tvinputdevice: {} } });
    expect(detectCapabilities(w)).toMatchObject({ isTizen: true, hasApplicationControl: false });
  });

  it('reports no TV input device off-Tizen', () => {
    expect(detectCapabilities(fakeWindow({ tizen: undefined }))).toMatchObject({
      isTizen: false,
      hasTvInputDevice: false,
      hasApplicationControl: false,
    });
  });

  it('always reports Shaka, because it is bundled rather than a global', () => {
    // Regression guard: probing window.shaka answered false on every shipped
    // TV, which made selectEngine() claim a perfectly good Shaka TV was
    // native-only. The app imports Shaka as a module and never sets the global.
    const w = fakeWindow({ shaka: undefined, ShakaPlayer: undefined });
    expect(detectCapabilities(w).hasShaka).toBe(true);
    expect(detectCapabilities({}).hasShaka).toBe(true);
  });

  it('reports a missing native engine', () => {
    const w = fakeWindow({ webapis: undefined });
    expect(detectCapabilities(w)).toMatchObject({ hasShaka: true, hasAvplay: false });
  });

  it('defaults the API version to 5.0 when tizen is absent', () => {
    const caps = detectCapabilities(fakeWindow({ tizen: undefined }));
    expect(caps.isTizen).toBe(false);
    expect(caps.webApiVersion).toBe(5.0);
  });

  it('reads an older TV API version', () => {
    expect(detectCapabilities(fakeWindow({ tizen: { webAPIVersion: '4.0' } })).webApiVersion).toBe(4.0);
  });

  it('survives a window missing every optional global', () => {
    const caps = detectCapabilities({});
    expect(caps).toMatchObject({
      isTizen: false,
      hasAbortController: false,
      hasResizeObserver: false,
      hasRequestVideoFrameCallback: false,
      hasMediaCapabilities: false,
      hasShaka: true,
      hasAvplay: false,
    });
  });

  it('does not throw when a global getter throws', () => {
    const w = fakeWindow();
    Object.defineProperty(w, 'ResizeObserver', {
      get() {
        throw new Error('boom');
      },
    });
    expect(() => detectCapabilities(w)).not.toThrow();
    expect(detectCapabilities(w).hasResizeObserver).toBe(false);
  });
});

describe('capabilities cache', () => {
  beforeEach(() => resetCapabilities());

  it('returns the same object on repeated calls', () => {
    expect(capabilities()).toBe(capabilities());
  });

  it('re-probes after a reset', () => {
    const first = capabilities();
    resetCapabilities();
    expect(capabilities()).not.toBe(first);
  });

  it('picks an engine from the cached capabilities', () => {
    expect(['shaka', 'native', 'none']).toContain(currentEngine());
  });
});

describe('TV model probe (T-200)', () => {
  beforeEach(() => resetTvModel());

  it('uses the callback result from systeminfo', () => {
    probeTvModel({
      tizen: {
        systeminfo: {
          getPropertyValue: (_key, ok) => ok({ model: 'UE55TU8000' }),
        },
      },
    });
    expect(getTvModel()).toBe('UE55TU8000');
  });

  it('falls back to a generic label when systeminfo errors', () => {
    probeTvModel({
      tizen: {
        systeminfo: {
          getPropertyValue: (_key, _ok, fail) => fail(new Error('no')),
        },
      },
    });
    expect(getTvModel()).toBe('Tizen TV');
  });

  it('never throws when the platform has no systeminfo', () => {
    expect(() => probeTvModel({})).not.toThrow();
    expect(() => probeTvModel(null)).not.toThrow();
  });
});
