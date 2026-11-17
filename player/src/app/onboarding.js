// First-run source picker (T-152b). Owns the empty-shell landing, the
// onboarding modal and its focus handling. Calls back into startup, boot and
// settings through deps: startup imports this slice, so a direct import of
// startPlayer would close the module cycle the registry exists to prevent.
import { getSettings } from '../config.js';
import * as ui from '../ui/index.js';
import * as settings from '../settings/index.js';
import { state, BOOT_IDLE_HOLD_MS } from './state.js';
import { deps } from './deps.js';

export function showFirstRun() {
  // First launch (or fetch failure with nothing cached): land on the player
  // shell with its empty state — never strand the user on Settings. The
  // menu opens showing the Settings button, and a hint names the Blue key.
  state.channels = state.channels || [];
  deps.startPlayer();
  ui.toggleRightSidebar();
  deps.showBootSplash('Loading...');
  const s = getSettings();
  const fresh = (s.playlists || []).length === 0 && (s.channels || []).length === 0;
  if (fresh) {
    // True first install: offer the source choice directly, no hint toast.
    // Skip if the user already opened Settings meanwhile.
    deps.hideBootSplash(BOOT_IDLE_HOLD_MS, () => {
      if (!settings.isVisible()) showOnboarding();
    });
    return;
  }
  deps.hideBootSplashAndMaybeWhatsNew(BOOT_IDLE_HOLD_MS, () => {
    setTimeout(() => {
      if (!deps.isWhatsNewOpen()) ui.showFirstRunHint();
    }, 1200);
  });
}

/* First-run source picker: M3U playlist or Xtream login, straight into the
   matching Settings add form. Shown only on true first installs. */

export function isOnboardingOpen() {
  const el = document.getElementById('onboarding-modal');
  return el && !el.classList.contains('hidden');
}

export function showOnboarding() {
  const modal = document.getElementById('onboarding-modal');
  if (!modal) return;
  // Fresh installs have no changelog to catch up on — don't stack What's New.
  deps.markVersionSeen();
  state.onboardFocus = 0;
  modal.classList.remove('hidden');
  updateOnboardFocus();
}

export function hideOnboarding() {
  const modal = document.getElementById('onboarding-modal');
  if (modal) modal.classList.add('hidden');
}

export function updateOnboardFocus() {
  const m3uBtn = document.getElementById('onboard-m3u');
  const xtBtn = document.getElementById('onboard-xtream');
  if (m3uBtn) {
    if (state.onboardFocus === 0) m3uBtn.setAttribute('data-focused', '');
    else m3uBtn.removeAttribute('data-focused');
  }
  if (xtBtn) {
    if (state.onboardFocus === 1) xtBtn.setAttribute('data-focused', '');
    else xtBtn.removeAttribute('data-focused');
  }
}

export function selectOnboarding() {
  const type = state.onboardFocus === 1 ? 'xtream' : 'm3u';
  hideOnboarding();
  deps.showSettingsPage();
  settings.openAddForm(type);
}

// Self-register so other slices (and the hub) reach these through slots.
Object.assign(deps, {
  showFirstRun,
  showOnboarding,
  hideOnboarding,
  updateOnboardFocus,
  selectOnboarding,
  isOnboardingOpen,
});
