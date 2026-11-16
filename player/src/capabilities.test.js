import { describe, it, expect, beforeEach } from 'vitest';
import { detectCapabilities, capabilities, resetCapabilities, currentEngine } from './capabilities.js';

// A minimal fake window. detectCapabilities() takes an explicit window so it
// can be tested without jsdom (the project runs vitest in a node env).
function fakeWindow(over = {}) {
  return {
    tizen: { webAPIVersion: '6.5' },
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

  it('detects ShakaPlayer under its alternate global', () => {
    const w = fakeWindow({ shaka: undefined, ShakaPlayer: {} });
    expect(detectCapabilities(w).hasShaka).toBe(true);
  });

  it('reports a missing engine', () => {
    const w = fakeWindow({ shaka: undefined, webapis: undefined });
    expect(detectCapabilities(w)).toMatchObject({ hasShaka: false, hasAvplay: false });
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
      hasShaka: false,
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
