// Runtime capability probe — the single place that reads platform globals.
//
// It lives here rather than in `lib/` because `lib/` is DOM-free by rule
// (`npm run validate`). This module touches `window` / `navigator` exactly
// once and hands a plain object to the pure decisions in
// `lib/capabilities.js`.
//
// Every platform decision in the app must read from `detectCapabilities()`
// and the `lib/` helpers — not from ad-hoc `typeof window.x` checks
// (docs/TIZEN_COMPAT.md §4).

import { parseWebApiVersion, selectEngine } from './lib/capabilities.js';

function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// `hasShaka` is NOT a platform capability. Shaka is bundled as an ES module
// (`import shaka from 'shaka-player'`), so the app never sets `window.shaka` —
// probing the global answered `false` on every TV the app actually ships to.
// If this code is running at all, Shaka is present.
export function detectCapabilities(win) {
  const w = win === undefined ? (typeof window !== 'undefined' ? window : null) : win;
  const nav = safe(() => (w && w.navigator) || null, null);

  return {
    isTizen: !!(w && w.tizen),
    hasTvInputDevice: !!(w && w.tizen && w.tizen.tvinputdevice),
    hasApplicationControl: !!(w && w.tizen && w.tizen.application),
    webApiVersion: parseWebApiVersion(safe(() => (w && w.tizen && w.tizen.webAPIVersion) || '5.0', '5.0')),
    hasAbortController: safe(() => typeof w.AbortController !== 'undefined', false),
    hasTrimStart: safe(() => typeof ''.trimStart === 'function', false),
    hasResizeObserver: safe(() => typeof w.ResizeObserver !== 'undefined', false),
    hasRequestVideoFrameCallback: safe(
      () =>
        !!(w && w.HTMLVideoElement && w.HTMLVideoElement.prototype) &&
        typeof w.HTMLVideoElement.prototype.requestVideoFrameCallback === 'function',
      false,
    ),
    hasMediaCapabilities: !!(nav && nav.mediaCapabilities),
    hasShaka: true,
    hasAvplay: !!(w && w.webapis && w.webapis.avplay),
  };
}

// Cached after first use — the platform does not change at runtime.
let cached = null;

export function capabilities() {
  if (!cached) cached = detectCapabilities();
  return cached;
}

export function resetCapabilities() {
  cached = null;
}

export function currentEngine() {
  return selectEngine(capabilities());
}
