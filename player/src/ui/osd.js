// Channel OSD, buffering pill, empty-state brand, watermark and tune toast
// (T-132). ui.js re-exports the public names so callers keep using ui.*.
// Only DOM + the shared UI state and pure helpers are used — no UI-slice deps.
// z-index values stay in styles.css (TIZEN_GUIDE.md §6.3): veil 30, pills 40,
// splash 200, modals 300. This move changes no CSS and sets no inline z-index.

import { escapeHtml } from '../utils.js';
import { attemptSuffix, slowHintFor } from '../logic.js';
import { state } from './state.js';
import { deps } from './deps.js';

/* Top-left logo + top-right quality badge visibility */
let showWatermark = true;
let showBadge = true;

export function setOverlayVisibility({ watermark, badge } = {}) {
  if (typeof watermark === 'boolean') showWatermark = watermark;
  if (typeof badge === 'boolean') showBadge = badge;
  applyWatermark();
  applyBadge();
}

function applyWatermark() {
  const watermark = document.getElementById('player-watermark');
  if (!watermark) return;
  if (!showWatermark) {
    watermark.classList.add('hidden');
    watermark.classList.remove('docked');
    return;
  }
  watermark.classList.remove('hidden');
  watermark.classList.toggle('docked', !state.sidebarOpen);
}

function applyBadge() {
  const el = document.getElementById('resolution-badge');
  if (!el) return;
  if (!showBadge) el.classList.add('hidden');
}

export function isBadgeVisible() {
  return showBadge;
}

/* Centered status line for dead-air states (no channels, failed tune,
   stopped) and post-tune buffering. The faint backdrop logo stays visible
   behind it — pass a reason to print as the message. */
export function showEmptyLogo(message) {
  const el = document.getElementById('player-empty-logo');
  if (el) el.classList.remove('hidden');
  if (typeof message === 'string') {
    const msgEl = document.getElementById('empty-logo-message');
    if (msgEl) {
      msgEl.textContent = message;
      msgEl.classList.toggle('hidden', message.length === 0);
    }
  }
}

export function hideEmptyLogo() {
  const el = document.getElementById('player-empty-logo');
  if (el) el.classList.add('hidden');
}

/* Channel OSD */
let osdTimer = null;

export function showChannelOsd(channel) {
  if (!channel) return;
  const el = document.getElementById('channel-osd');
  if (!el) return;
  clearTimeout(osdTimer);
  el.classList.remove('fade');
  el.classList.remove('hidden');
  el.innerHTML = '<span class="osd-number">' + (channel.channelNumber || '') + '</span>' + escapeHtml(channel.name);
  osdTimer = setTimeout(() => {
    el.classList.add('fade');
    setTimeout(() => {
      el.classList.add('hidden');
    }, 300);
  }, 2000);
}

/* First-run hint: same OSD home, longer stay, plain guidance text */
export function showFirstRunHint() {
  showOsdText('No playlist yet — choose Settings from the menu', 5000);
}

/* Transient notice: same OSD home, custom text (e.g. stale-cache fallback) */
export function showTransientNotice(text, ms = 5000) {
  showOsdText(text, ms);
}

function showOsdText(text, ms) {
  const el = document.getElementById('channel-osd');
  if (!el) return;
  clearTimeout(osdTimer);
  el.classList.remove('fade');
  el.classList.remove('hidden');
  el.textContent = text;
  osdTimer = setTimeout(() => {
    el.classList.add('fade');
    setTimeout(() => {
      el.classList.add('hidden');
    }, 300);
  }, ms);
}

/* Channel toast (top) + buffering pill (bottom) with time-aware hints.
   A stuck number makes users zap away — name + hint prove work is ongoing. */
let bufferingChannelName = '';
let bufferingStart = 0;
let bufferingHintTimer = null;
// Single-narrative tune UX: one bottom line owns the whole tune story —
// connecting → buffering → playing/error. Retries stay silent except for a
// light " • try N" suffix once they begin.
let tuneStage = 'idle'; // idle | connecting | buffering
let tuneAttempt = 1;

export function setBufferingChannel(name) {
  bufferingChannelName = name || '';
  const nameEl = document.getElementById('loading-name');
  if (nameEl) nameEl.textContent = bufferingChannelName || 'Loading';
}

// Synchronous hard reset for every channel select (slow or fast-tapped):
// veil + spinner + name, bottom line on "Connecting…", everything else
// hidden — so a previous tune's late callbacks have no stale text to land on.
export function resetTuneStatus(name) {
  hideBuffering();
  hideEmptyLogo();
  const err = document.getElementById('error');
  if (err) err.classList.add('hidden');
  tuneStage = 'connecting';
  tuneAttempt = 1;
  setBufferingChannel(name);
  showChannelToast();
  renderTuneLine();
}

// Silent-retry counter from the player: re-renders the current bottom line
// with the light attempt suffix. Never shows text of its own.
export function setTuneAttempt(n) {
  tuneAttempt = n > 0 ? n : 1;
  renderTuneLine();
}

function renderTuneLine() {
  if (tuneStage !== 'connecting') return;
  const hint = document.getElementById('buffering-hint');
  if (!hint) return;
  hint.textContent = 'Connecting…' + attemptSuffix(tuneAttempt);
  hint.classList.remove('hidden');
}

// Phase 1 of channel select: full veil with spinner + centered name, so the
// user never sees a blank screen. The name stays put through buffering.
export function showChannelToast() {
  const veil = document.getElementById('loading');
  if (veil) veil.classList.remove('hidden');
  const spinner = veil ? veil.querySelector('.spinner') : null;
  if (spinner) spinner.classList.remove('hidden');
}

export function showBuffering(percent) {
  const el = document.getElementById('buffering-indicator');
  if (!el) return;
  tuneStage = 'buffering';
  el.classList.remove('hidden');
  setBufferingPercent(percent);
  bufferingStart = Date.now();
  updateBufferingHint();
  clearInterval(bufferingHintTimer);
  bufferingHintTimer = setInterval(updateBufferingHint, 1000);
}

function updateBufferingHint() {
  const el = document.getElementById('buffering-hint');
  if (!el) return;
  const hint = slowHintFor(Date.now() - bufferingStart);
  el.textContent = hint;
  el.classList.toggle('hidden', hint.length === 0);
}

export function updateBuffering(percent) {
  const el = document.getElementById('buffering-indicator');
  if (el && !el.classList.contains('hidden')) {
    setBufferingPercent(percent);
  }
}

export function hideBuffering() {
  tuneStage = 'idle';
  const el = document.getElementById('buffering-indicator');
  if (el) el.classList.add('hidden');
  const veil = document.getElementById('loading');
  if (veil) veil.classList.add('hidden');
  clearInterval(bufferingHintTimer);
  bufferingHintTimer = null;
  const hint = document.getElementById('buffering-hint');
  if (hint) {
    hint.textContent = '';
    hint.classList.add('hidden');
  }
}

function setBufferingPercent(percent) {
  const p = document.getElementById('buffering-percent');
  if (p) p.textContent = (typeof percent === 'number' ? percent : 0) + '%' + attemptSuffix(tuneAttempt);
}

// Wire the watermark helper the chrome slice calls through.
deps.applyWatermark = applyWatermark;
