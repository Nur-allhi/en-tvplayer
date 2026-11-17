// Pure engine-fallback decision (T-191). Maps the two booleans the app can
// know at boot to a playback mode and the notice the user should see. No DOM,
// no timers — the caller owns rendering the message.

/**
 * @param {boolean} shakaUsable - Shaka's browser-support probe passed
 * @param {boolean} avplayAvailable - native AVPlay is present on this device
 * @returns {{mode: 'shaka'|'native'|'none', notice: string|null}}
 */
export function fallbackNotice(shakaUsable, avplayAvailable) {
  if (shakaUsable) return { mode: 'shaka', notice: null };
  if (avplayAvailable) {
    return {
      mode: 'native',
      notice: 'Native playback mode — DRM-protected channels are unavailable on this device.',
    };
  }
  return {
    mode: 'none',
    notice: 'This device cannot play video streams. Please restart the app or update your TV software.',
  };
}

/** True when the given mode needs a notice shown before playback starts. */
export function needsNotice(mode) {
  return mode === 'native' || mode === 'none';
}
