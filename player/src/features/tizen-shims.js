// Guarded platform shims (T-190). Installs AbortController, trimStart and
// ResizeObserver ONLY when the target engine lacks them, so modern engines are
// untouched. A tiny AbortController/AbortSignal suffices for the app's own
// fetch cancellations; ResizeObserver is a no-observer stub (Shaka degrades
// gracefully) rather than a full layout engine.
//
// The target is injectable so this is unit-testable in node env with no DOM.

/** Minimal AbortSignal/AbortController pair for engines that lack them. */
function makeAbortController() {
  class AbortSignalShim {
    constructor() {
      this.aborted = false;
      this.onabort = null;
    }
    get reason() {
      return undefined;
    }
    addEventListener(type, fn) {
      if (type === 'abort') this.onabort = fn;
    }
    removeEventListener(type, fn) {
      if (this.onabort === fn) this.onabort = null;
    }
    dispatchEvent() {
      return true;
    }
  }
  class AbortControllerShim {
    constructor() {
      this.signal = new AbortSignalShim();
    }
    abort() {
      if (this.signal.aborted) return;
      this.signal.aborted = true;
      if (typeof this.signal.onabort === 'function') this.signal.onabort({ target: this.signal });
    }
  }
  return { AbortControllerShim, AbortSignalShim };
}

/** Install missing shims on `target`. Returns the names it installed. */
export function installShims(target) {
  const installed = [];
  if (!target || typeof target !== 'object') return installed;

  if (typeof target.AbortController === 'undefined') {
    const { AbortControllerShim, AbortSignalShim } = makeAbortController();
    target.AbortController = AbortControllerShim;
    // The app constructs AbortController from the global scope; on browsers
    // target is window and AbortSignal sits there too.
    if (typeof target.AbortSignal === 'undefined') target.AbortSignal = AbortSignalShim;
    installed.push('AbortController');
  }

  const StringProto = target.String && target.String.prototype ? target.String.prototype : null;
  if (StringProto && typeof StringProto.trimStart !== 'function') {
    Object.defineProperty(StringProto, 'trimStart', {
      value: function trimStart() {
        return String(this).replace(/^\s+/, '');
      },
      configurable: true,
      writable: true,
    });
    installed.push('trimStart');
  }

  if (typeof target.ResizeObserver === 'undefined') {
    target.ResizeObserver = class ResizeObserverShim {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    installed.push('ResizeObserver');
  }

  return installed;
}
