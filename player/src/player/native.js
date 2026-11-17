// Native AVPlay path (T-123).
import { deps } from './deps.js';
import { state } from './state.js';
import * as avplay from '../avplay.js';
import { withAuthQuery } from '../lib/url.js';

export function avplayStreamUrl(channel) {
  return withAuthQuery(channel.url, channel.authQuery);
}

export async function loadViaAvplay(channel, myToken) {
  deps.showLoading(true);
  deps.hideError();
  if (state.videoElement) state.videoElement.classList.add('hidden');
  avplay.onBuffering((buffering, percent) => {
    if (myToken !== state.loadToken) return;
    deps.showLoading(false);
    if (typeof percent === 'number') state.avplayBufferPercent = percent;
    if (state.bufferingCallback) state.bufferingCallback(buffering, percent);
  });
  avplay.onError((type) => {
    if (myToken !== state.loadToken) return;
    state.avplayFailedUrls.add(channel.url);
    state.avplayPreferredUrls.delete(channel.url);
    deps.logEvent('ERROR', 'Native playback failed (' + type + '): ' + (channel.name || channel.url.slice(0, 60)));
    deps.showError('This channel could not play on your TV. Try another channel.');
  });
  let referer = null;
  if (channel.customHeaders) {
    for (const [k, v] of Object.entries(channel.customHeaders)) {
      if (k.toLowerCase() === 'referer') referer = v;
    }
  }
  const ok = await avplay.play(avplayStreamUrl(channel), {
    userAgent: channel.userAgent || null,
    referer,
  });
  if (myToken !== state.loadToken) return false;
  deps.showLoading(false);
  if (!ok) {
    state.avplayFailedUrls.add(channel.url);
    state.avplayPreferredUrls.delete(channel.url);
    deps.showError('This channel could not play on your TV. Try another channel.');
    return false;
  }
  state.useAvplay = true;
  deps.hideError();
  state.reconnectAttempts = 0;
  state.consecutiveErrors = 0;
  state.lastResortAttempts = 0;
  state.hardReloads = 0;
  deps.logEvent('INFO', 'Playing natively: ' + (channel.name || channel.url.slice(0, 60)));
  return true;
}

export async function switchToAvplay() {
  const channel = state.currentChannel;
  const tokenAtSwitch = state.loadToken;
  if (!channel || !avplay.isAvailable()) return false;
  deps.stopBlackWatchdog();
  deps.stopStallWatchdog();
  deps.logEvent(
    'WARN',
    'No frames rendered — switching to native playback: ' + (channel.name || channel.url.slice(0, 80)),
  );
  if (state.player) {
    try {
      await state.player.destroy();
    } catch {}
    state.player = null;
  }
  if (tokenAtSwitch !== state.loadToken) return false;
  return loadViaAvplay(channel, tokenAtSwitch);
}

// This slice wires its own deps slots. The hub only assembles the API.
Object.assign(deps, {
  loadViaAvplay,
  switchToAvplay,
});
