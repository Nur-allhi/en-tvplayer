// What's New modal (T-152b). The version-seen flag, the modal renderer and the
// splash hand-off. checkWhatsNew/markVersionSeen are DOM-free apart from
// localStorage, so they stay with the modal they guard. Cross-slice calls go
// through deps so this file never imports main.js or the onboarding slice.
import { APP_VERSION } from '../config.js';
import { CHANGELOG } from './changelog.js';
import { state } from './state.js';
import { deps } from './deps.js';

const LAST_SEEN_KEY = 'en_last_seen_version';

export function checkWhatsNew() {
  try {
    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
    if (lastSeen === APP_VERSION) return false;
    return true;
  } catch {
    return true;
  }
}

export function markVersionSeen() {
  try {
    localStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
  } catch {}
}

export function showWhatsNew() {
  const modal = document.getElementById('whats-new-modal');
  const body = document.getElementById('whats-new-body');
  const verEl = document.getElementById('whats-new-version');
  const closeBtn = document.getElementById('whats-new-close');
  if (!modal || !body) return;

  if (verEl) verEl.textContent = 'v' + APP_VERSION;
  const iconMap = { added: ['\u2713', 'added'], fixed: ['\u26A0', 'fixed'], changed: ['\u2192', 'changed'] };
  let html = '';
  if (state.pendingUpdate) {
    html += '<div class="wn-section">';
    html += '<div class="wn-section-title">Update available: v' + state.pendingUpdate.latest + '</div>';
    html +=
      '<div class="wn-item"><span class="wn-icon added">\u2192</span><span>Reinstall via Apps2Samsung to update.</span></div>';
    html += '</div>';
  }
  for (const entry of CHANGELOG) {
    if (entry.version === '1.0.0') break;
    html += '<div class="wn-section">';
    html += '<div class="wn-section-title">v' + entry.version + '</div>';
    for (const sec of entry.sections) {
      const [icon, cls] = iconMap[sec.type] || ['\u2022', 'added'];
      for (const item of sec.items) {
        html +=
          '<div class="wn-item"><span class="wn-icon ' + cls + '">' + icon + '</span><span>' + item + '</span></div>';
      }
    }
    html += '</div>';
  }
  body.innerHTML = html;
  modal.classList.remove('hidden');
  // Focus the button for remote/keyboard navigation
  closeBtn.focus();
  // Also handle keyboard Enter/Escape for desktop
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      document.removeEventListener('keydown', onKey);
      closeWhatsNew();
    }
  };
  document.addEventListener('keydown', onKey);
}

export function hideBootSplashAndMaybeWhatsNew(holdAfterTypeMs = 0, onDone = null) {
  // The modal waits for the splash to be fully gone — a fixed timer raced
  // the zoom/fade exit and popped it over the splash mid-load.
  deps.hideBootSplash(holdAfterTypeMs, () => {
    if (typeof onDone === 'function') onDone();
    if (checkWhatsNew()) {
      setTimeout(showWhatsNew, 300);
    }
  });
}

export function isWhatsNewOpen() {
  const el = document.getElementById('whats-new-modal');
  return el && !el.classList.contains('hidden');
}

export function closeWhatsNew() {
  const modal = document.getElementById('whats-new-modal');
  if (modal) modal.classList.add('hidden');
  markVersionSeen();
}

// Self-register so onboarding, remote and the hub reach these through slots.
Object.assign(deps, {
  checkWhatsNew,
  showWhatsNew,
  closeWhatsNew,
  markVersionSeen,
  isWhatsNewOpen,
  hideBootSplashAndMaybeWhatsNew,
});
