// Playback event subscription setters (T-122).
//
// These only write callbacks into the shared state object; every engine
// slice reads them from there. Keeping this module dependency-light avoids
// an import cycle with player.js and the other slices.
import { state } from './state.js';

export function onBuffering(callback) {
  state.bufferingCallback = callback;
}

export function onTrackChange(callback) {
  state.trackCallback = callback;
}

export function onChannelAdvance(callback) {
  state.channelAdvanceCallback = callback;
}

export function onTokenExpired(callback) {
  state.tokenExpiredCallback = callback;
}

// Silent-retry counter for the single-narrative status line: the UI shows a
// light " • try N" suffix once retries begin, instead of retry sentences.
export function onTuneAttempt(callback) {
  state.tuneAttemptCallback = callback;
}
