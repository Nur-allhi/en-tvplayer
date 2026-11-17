// Boot splash staging (T-150). The three functions that sequence the
// launch logo and typewriter. They share three timers/flags, so they live in
// one slice with one state object. Staging chains on completion callbacks —
// never fixed sleeps (docs/TIZEN_GUIDE.md §7).
import { state } from './state.js';
import { APP_VERSION } from '../config.js';

const BOOT_TITLE = 'EN IPTV';
const BOOT_TAGLINE = 'Smart IPTV Player for Samsung TV';
const BOOT_TITLE_DELAY = 500;
const BOOT_TITLE_CHAR = 90;
const BOOT_TAGLINE_GAP = 200;
const BOOT_TAGLINE_CHAR = 40;

const BOOT_MIN_MS = 1500; // logo stays at least this long on every launch
const BOOT_ZOOM_MS = 700; // fly-into-the-logo exit
const BOOT_READ_MS = 1800;

export function showBootSplash(statusText) {
  const el = document.getElementById('boot-splash');
  const statusEl = document.getElementById('boot-status');
  const typeEl = document.getElementById('boot-typewriter');
  const loadingEl = document.getElementById('boot-loading');
  const verEl = document.getElementById('boot-version');
  if (!el) return;
  if (statusEl && statusText) statusEl.textContent = statusText;
  if (verEl) verEl.textContent = 'v' + APP_VERSION;
  // Reset animation state
  const titleEl = document.getElementById('boot-logo-text');
  if (titleEl) {
    titleEl.textContent = '';
    titleEl.classList.add('typing');
  }
  if (typeEl) {
    typeEl.textContent = '';
    typeEl.classList.remove('done');
  }
  if (loadingEl) {
    loadingEl.style.animation = 'none';
    loadingEl.offsetHeight;
    loadingEl.style.animation = '';
  }
  const logo = document.getElementById('boot-logo');
  if (logo) logo.classList.remove('zoom-in');
  el.classList.remove('hidden', 'fade-out', 'zooming');
  state.bootShownAt = Date.now();
  // Stage 1: icon is already visible — type the title, then the tagline.
  clearTimeout(state.bootTypewriterTimer);
  state.bootTypewriterEnd =
    state.bootShownAt +
    BOOT_TITLE_DELAY +
    BOOT_TITLE.length * BOOT_TITLE_CHAR +
    BOOT_TAGLINE_GAP +
    BOOT_TAGLINE.length * BOOT_TAGLINE_CHAR;
  startTypewriter(titleEl, BOOT_TITLE, BOOT_TITLE_CHAR, BOOT_TITLE_DELAY, () => {
    // Colorize "IPTV" once typing finishes, drop the caret.
    if (titleEl) {
      titleEl.innerHTML = 'EN <span>IPTV</span>';
      titleEl.classList.remove('typing');
    }
    startTypewriter(typeEl, BOOT_TAGLINE, BOOT_TAGLINE_CHAR, BOOT_TAGLINE_GAP);
  });
}

export function startTypewriter(el, text, charDelay, startDelay, onDone) {
  if (!el) {
    if (onDone) onDone();
    return;
  }
  let i = 0;
  state.bootTypewriterTimer = setTimeout(function tick() {
    if (i < text.length) {
      el.textContent = text.slice(0, i + 1);
      i++;
      state.bootTypewriterTimer = setTimeout(tick, charDelay);
    } else {
      el.classList.add('done');
      if (onDone) onDone();
    }
  }, startDelay);
}

export function hideBootSplash(holdAfterTypeMs = 0, onDone = null) {
  const el = document.getElementById('boot-splash');
  const finish = () => {
    if (typeof onDone === 'function') onDone();
  };
  if (!el || el.classList.contains('hidden')) {
    finish();
    return;
  }
  // Hold the logo for a beat AND until the tagline finishes typing
  // (plus an optional extra hold for the idle/no-fetch path),
  // then fly into it before fading the overlay.
  const waitMin = Math.max(0, BOOT_MIN_MS - (Date.now() - state.bootShownAt));
  const waitType = Math.max(0, state.bootTypewriterEnd - Date.now()) + holdAfterTypeMs;
  const wait = Math.max(waitMin, waitType) + BOOT_READ_MS;
  setTimeout(() => {
    clearTimeout(state.bootTypewriterTimer);
    el.classList.add('zooming');
    const logo = document.getElementById('boot-logo');
    if (logo) logo.classList.add('zoom-in');
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => {
        el.classList.add('hidden');
        el.classList.remove('fade-out', 'zooming');
        if (logo) logo.classList.remove('zoom-in');
        finish();
      }, 500);
    }, BOOT_ZOOM_MS);
  }, wait);
}
