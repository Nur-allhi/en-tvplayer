// Public playback controls (T-123).
import { deps } from './deps.js';
import { state } from './state.js';
import * as avplay from '../avplay.js';

export function stop() {
  avplay.stop();
  state.userPaused = false;
  if (state.videoElement) state.videoElement.classList.remove('hidden');
  deps.destroyPlayer().catch(() => {});
  deps.showLoading(false);
  deps.hideError();
}

export function togglePlay() {
  if (state.useAvplay) {
    if (state.avplayPaused) {
      state.avplayPaused = false;
      avplay.resume();
    } else {
      state.avplayPaused = true;
      avplay.pause();
    }
    return;
  }
  if (!state.videoElement) return;

  if (state.videoElement.paused) {
    state.userPaused = false;
    deps.tryResumeVideo();
  } else {
    state.userPaused = true;
    state.videoElement.pause();
  }
}

export function isNativeAvailable() {
  return avplay.isAvailable();
}
