// Pure decision logic for capability-based engine selection.
//
// The probe itself cannot live here — it reads `window` / `navigator`, and
// `lib/` is DOM-free by rule (`npm run validate` enforces it). The probe lives
// in `player/src/capabilities.js` and passes a plain capabilities object to
// the pure helpers below, which is what makes the decisions testable without
// a browser (docs/TIZEN_COMPAT.md §4).

// Samsung's docs put Proxy support at Tizen 5.0; Shaka Player 5.x depends on
// it and it cannot be polyfilled, which is why 4.0 is out of scope.
export const MIN_WEB_API_VERSION = 5.0;

export function parseWebApiVersion(raw) {
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

export function meetsMinimumPlatform(caps) {
  if (!caps || !caps.isTizen) return true; // not a TV — do not block desktop dev
  return typeof caps.webApiVersion === 'number' && caps.webApiVersion >= MIN_WEB_API_VERSION;
}

// Which engine to prefer, given availability. Shaka wins when present; native
// AVPlay is the only option when it is not.
//
// This answers "what could we use". It does NOT answer "what is this channel
// using" — player.js tracks that per channel (avplayPreferredUrls, useAvplay),
// because a channel can fall back to native while the platform still has Shaka.
export function selectEngine(caps) {
  if (!caps) return 'none';
  if (caps.hasShaka) return 'shaka';
  if (caps.hasAvplay) return 'native';
  return 'none';
}

export function engineLabel(engine) {
  if (engine === 'shaka') return 'Shaka';
  if (engine === 'native') return 'Native';
  return 'None';
}

// Features the app needs a shim for on the current platform. Empty on a
// supported TV; anything listed here is a compatibility bug to fix.
export function missingApis(caps) {
  if (!caps) return [];
  const missing = [];
  if (!caps.hasAbortController) missing.push('AbortController');
  if (!caps.hasTrimStart) missing.push('trimStart');
  if (!caps.hasResizeObserver) missing.push('ResizeObserver');
  return missing;
}

// The Tizen remote-key API. Only a TV registers special keys, and only a TV
// opens its IME on an explicit OK press, so both behaviours key off this.
export function hasTvKeyInput(caps) {
  return !!(caps && caps.hasTvInputDevice);
}

// Reported to the opt-in usage ping. Distinguishes a TV from a desktop
// browser without the caller re-reading globals.
export function platformName(caps) {
  if (caps && caps.isTizen) return 'tizen';
  return 'browser';
}

// True when the platform can watch video progression without a timer.
export function canObserveVideoFrames(caps) {
  return !!(caps && caps.hasRequestVideoFrameCallback);
}
