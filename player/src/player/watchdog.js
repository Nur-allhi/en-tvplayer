// Stall/black watchdogs (T-123).
import { deps } from './deps.js';
import { state } from './state.js';
import { stallPatienceExceeded, shouldResumePlayback, isNetworkActive, hardReloadDecision } from '../logic.js';
import * as avplay from '../avplay.js';

export function startStallWatchdog() {
  stopStallWatchdog();
  state.lastStallTime = state.videoElement ? state.videoElement.currentTime : 0;
  state.lastStallCheck = Date.now();
  state.stallDeferrals = 0;
  state.stallWatchdogTimer = setInterval(() => {
    if (!state.videoElement || state.videoElement.ended) return;
    if (
      shouldResumePlayback({
        paused: state.videoElement.paused,
        ended: state.videoElement.ended,
        userPaused: state.userPaused,
      })
    ) {
      // Late stale teardown (or autoplay miss) paused the video behind our
      // back — resume it. If the src was wiped too, play() fails and the
      // frozen clock below escalates to a reload instead of sitting stuck.
      tryResumeVideo();
      return;
    }
    if (state.videoElement.paused) return; // user's own pause — leave alone
    const now = state.videoElement.currentTime;
    if (now === state.lastStallTime && Date.now() - state.lastStallCheck > 15000) {
      // Slow, not stuck: Shaka fetched recently (segments flowing, decoder
      // waiting, or its own retry cycle running) — re-baseline and keep
      // waiting instead of trampling a recovery already in flight. Bounded:
      // a chatty-but-starved stream still escalates after ~60s frozen.
      if (isNetworkActive(state.lastShakaActivity, Date.now())) {
        state.stallDeferrals++;
        if (!stallPatienceExceeded(state.stallDeferrals)) {
          state.lastStallTime = now;
          state.lastStallCheck = Date.now();
          return;
        }
        deps.logEvent('WARN', 'Stall persists with live network — restarting anyway');
      }
      state.consecutiveErrors++;
      deps.logEvent('WARN', 'Stall detected (no progress for 15s)');
      if (state.consecutiveErrors >= 3) {
        state.consecutiveErrors = 0;
        state.hardReloads++;
        // Budgeted per tune — see handlePlayerError above. A channel that
        // never produces frames must end on a message, not on an app kill.
        if (hardReloadDecision(state.hardReloads) === 'giveup') {
          deps.giveUpTune();
          return;
        }
        deps.logEvent('INFO', '3 stalls — hard reloading channel');
        deps.loadChannel(state.currentChannel);
      } else {
        deps.scheduleReconnect();
      }
      return;
    }
    if (now !== state.lastStallTime) {
      state.lastStallTime = now;
      state.lastStallCheck = Date.now();
      state.stallDeferrals = 0;
    }
  }, 2000);
}

export function stopStallWatchdog() {
  if (state.stallWatchdogTimer) {
    clearInterval(state.stallWatchdogTimer);
    state.stallWatchdogTimer = null;
  }
}

export function tryResumeVideo() {
  try {
    if (!state.videoElement) return;
    const pending = state.videoElement.play();
    if (pending && typeof pending.catch === 'function') {
      pending.catch((e) => {
        deps.logEvent('WARN', 'Resume attempt failed: ' + (e && e.name ? e.name : e));
      });
    }
  } catch (e) {
    deps.logEvent('WARN', 'Resume attempt threw: ' + (e && e.message ? e.message : e));
  }
}

export function startBlackWatchdog() {
  stopBlackWatchdog();
  const tokenAtStart = state.loadToken;
  state.blackWatchTimer = setTimeout(() => {
    state.blackWatchTimer = null;
    if (tokenAtStart !== state.loadToken || state.useAvplay || !state.currentChannel) return;
    if (state.avplayFailedUrls.has(state.currentChannel.url)) return;
    if (!state.videoElement || state.videoElement.paused) return;
    if (state.videoElement.readyState < 2) return;
    if (typeof state.videoElement.requestVideoFrameCallback === 'function') {
      let painted = false;
      try {
        state.videoElement.requestVideoFrameCallback(() => {
          painted = true;
        });
      } catch {
        return;
      }
      setTimeout(() => {
        if (tokenAtStart !== state.loadToken || state.useAvplay || !state.currentChannel) return;
        if (state.videoElement && state.videoElement.paused) return;
        if (!painted) onBlackScreen();
      }, 3000);
      return;
    }
    let total = -1;
    try {
      const q = state.videoElement.getVideoPlaybackQuality();
      if (q) total = q.totalVideoFrames || 0;
    } catch {
      return;
    }
    if (total >= 0 && total < 5) onBlackScreen();
  }, 9000);
}

export function onBlackScreen() {
  if (!state.currentChannel || state.avplayFailedUrls.has(state.currentChannel.url)) return;
  if (!avplay.isAvailable()) {
    deps.logEvent('ERROR', 'Undecodable stream, no native fallback: ' + state.currentChannel.url.slice(0, 100));
    deps.showError(
      'This channel uses a format the TV browser cannot display. Try a native player app for this channel.',
    );
    return;
  }
  state.avplayPreferredUrls.add(state.currentChannel.url);
  deps.switchToAvplay();
}

export function stopBlackWatchdog() {
  if (state.blackWatchTimer) {
    clearTimeout(state.blackWatchTimer);
    state.blackWatchTimer = null;
  }
}

export function isRenderingFrames() {
  try {
    return (
      !!state.videoElement &&
      !state.videoElement.paused &&
      !state.videoElement.ended &&
      state.videoElement.readyState >= 3 &&
      state.videoElement.currentTime > 0
    );
  } catch {
    return false;
  }
}

// This slice wires its own deps slots. The hub only assembles the API.
Object.assign(deps, {
  startStallWatchdog,
  stopStallWatchdog,
  tryResumeVideo,
  startBlackWatchdog,
  stopBlackWatchdog,
  isRenderingFrames,
});
