// Info-bar plugin (T-202). Owns the post-zap OSD entirely in this module: it
// subscribes to the reactive UI store, so showing the bar on a channel switch
// needs no edit to ui/core.js. Disabling the `infoBar` feature stops both the
// subscription effect and its DOM. Pure formatting lives in lib/info-bar.js.

import { uiState } from '../state/index.js';
import { isEnabled, registerFeature } from '../app/plugins.js';
import { formatInfoBar, buildInfoBar } from '../lib/info-bar.js';

export const INFO_BAR_HIDE_MS = 8000;
export { formatInfoBar, buildInfoBar };

let hideTimer = null;
let lastIndex = null;
let unsubscribe = null;

export function showInfoBar(channel, meta = {}, clockText) {
  if (typeof document === 'undefined') return '';
  const el = document.getElementById('info-bar');
  if (!el) return '';
  const clock = clockText || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const text = formatInfoBar(channel, { ...meta, clock });
  el.textContent = text;
  el.classList.remove('hidden', 'fade');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.classList.add('fade');
    hideTimer = setTimeout(() => el.classList.add('hidden'), 300);
  }, INFO_BAR_HIDE_MS);
  return text;
}

// Called for every currentIndex change. Public so tests can drive it without
// a DOM or a timer.
export function onChannelChanged(index, channels) {
  if (lastIndex === index) return;
  lastIndex = index;
  if (!isEnabled('infoBar')) return;
  const channel = Array.isArray(channels) ? channels[index] : null;
  if (channel) showInfoBar(channel);
}

export function startInfoBar() {
  stopInfoBar();
  unsubscribe = uiState.subscribe((value) => {
    if (value.currentIndex !== lastIndex) onChannelChanged(value.currentIndex, value.channels);
  });
  lastIndex = uiState.get().currentIndex;
  return unsubscribe;
}

export function stopInfoBar() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  clearTimeout(hideTimer);
  hideTimer = null;
  lastIndex = null;
}

export const contract = { id: 'infoBar', owns: ['#info-bar'], hideMs: INFO_BAR_HIDE_MS };

if (isEnabled('infoBar')) {
  registerFeature('infoBar', { contract, enabled: true, ui: ['info-bar'], keys: [] });
  startInfoBar();
}

export default contract;
