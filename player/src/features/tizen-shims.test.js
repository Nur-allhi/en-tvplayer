import { describe, it, expect } from 'vitest';
import { installShims } from './tizen-shims.js';

function emptyTarget() {
  function String() {}
  return { String };
}

function modernTarget() {
  const t = emptyTarget();
  t.AbortController = class AC {};
  t.AbortSignal = class AS {};
  t.String.prototype.trimStart = function () {};
  t.String.prototype.trimEnd = function () {};
  t.ResizeObserver = class RO {};
  return t;
}

describe('installShims — missing APIs', () => {
  it('installs all three shims on an empty target', () => {
    const t = emptyTarget();
    expect(installShims(t).sort()).toEqual(['AbortController', 'ResizeObserver', 'trimStart']);
    expect(typeof t.AbortController).toBe('function');
    expect(typeof t.String.prototype.trimStart).toBe('function');
    expect(typeof t.ResizeObserver).toBe('function');
  });

  it('provides a working AbortController that signals abort', () => {
    const t = emptyTarget();
    installShims(t);
    const c = new t.AbortController();
    let fired = 0;
    c.signal.addEventListener('abort', () => fired++);
    c.abort();
    expect(c.signal.aborted).toBe(true);
    expect(fired).toBe(1);
  });

  it('abort is idempotent', () => {
    const t = emptyTarget();
    installShims(t);
    const c = new t.AbortController();
    let fired = 0;
    c.signal.addEventListener('abort', () => fired++);
    c.abort();
    c.abort();
    expect(fired).toBe(1);
  });

  it('trimStart shim removes leading whitespace only', () => {
    const t = emptyTarget();
    installShims(t);
    expect('   hello  '.trimStart()).toBe('hello  ');
  });

  it('ResizeObserver shim has the observer methods', () => {
    const t = emptyTarget();
    installShims(t);
    const ro = new t.ResizeObserver();
    expect(() => {
      ro.observe({});
      ro.unobserve({});
      ro.disconnect();
    }).not.toThrow();
  });

  it('also installs AbortSignal when missing', () => {
    const t = emptyTarget();
    installShims(t);
    expect(typeof t.AbortSignal).toBe('function');
  });
});

describe('installShims — modern engines', () => {
  it('installs nothing when all APIs exist', () => {
    const t = modernTarget();
    expect(installShims(t)).toEqual([]);
  });

  it('does not replace existing constructors', () => {
    const t = modernTarget();
    const AC = t.AbortController;
    const RO = t.ResizeObserver;
    const trim = t.String.prototype.trimStart;
    installShims(t);
    expect(t.AbortController).toBe(AC);
    expect(t.ResizeObserver).toBe(RO);
    expect(t.String.prototype.trimStart).toBe(trim);
  });

  it('is idempotent on a second call', () => {
    const t = emptyTarget();
    const first = installShims(t).sort();
    const second = installShims(t);
    expect(first).toEqual(['AbortController', 'ResizeObserver', 'trimStart']);
    expect(second).toEqual([]);
  });

  it('tolerates a null or non-object target', () => {
    expect(installShims(null)).toEqual([]);
    expect(installShims(undefined)).toEqual([]);
    expect(installShims('no')).toEqual([]);
  });

  it('skips trimStart only when String is absent', () => {
    const t = { AbortController: class {}, ResizeObserver: class {} };
    expect(installShims(t)).toEqual([]);
    expect(t.String).toBeUndefined();
  });
});
