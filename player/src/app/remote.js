// Remote-action routing for the M5 app split (T-151). This slice owns
// handleRemoteAction, registerTizenKeys and zapChannel; it self-registers all
// three into deps so no slice imports main.js (the hub until T-152). Modal and
// settings routing stays here; view-specific branches live in remote-views.js
// so each file stays under the 300-LOC cap.
import { registerTizenKeys } from '../features/tizen-compat.js';
import { dispatchFeatureRoute } from './route-dispatch.js';
import * as settings from '../settings/index.js';
import * as ui from '../ui/index.js';
import { deps } from './deps.js';
import { state } from './state.js';
import { handlePlayerViewAction, handleRightSidebarAction, handleSidebarAction } from './remote-views.js';

// Owned by features/tizen-compat.js; re-exported so existing slot wiring and
// callers keep the same API while the hub no longer knows the key list.
export { registerTizenKeys };

// CH Up/Down (and Prev/Next keys): retune to the adjacent channel in the
// current group view, wrapping around.
export function zapChannel(step) {
  const displayChannels = deps.getDisplayChannels();
  if (displayChannels.length === 0) return;
  const currentDisplayIdx = displayChannels.indexOf(state.channels[state.currentIndex]);
  const idx = currentDisplayIdx >= 0 ? currentDisplayIdx : 0;
  const target = (idx + step + displayChannels.length) % displayChannels.length;
  state.currentIndex = state.channels.indexOf(displayChannels[target]);
  ui.selectChannel(state.currentIndex, true);
}

export function handleRemoteAction(action, value) {
  if (action === 'back') {
    const now = Date.now();
    if (now - state.lastBackTime < 600) return;
    state.lastBackTime = now;
  }
  if (deps.isOnboardingOpen()) {
    switch (action) {
      case 'left':
      case 'right':
      case 'up':
      case 'down':
        state.onboardFocus = state.onboardFocus === 0 ? 1 : 0;
        deps.updateOnboardFocus();
        break;
      case 'select':
        deps.selectOnboarding();
        break;
      case 'back':
        deps.hideOnboarding();
        break;
      default:
        break;
    }
    return;
  }
  if (deps.isWhatsNewOpen()) {
    switch (action) {
      case 'select':
      case 'back':
        deps.closeWhatsNew();
        break;
    }
    return;
  }
  if (ui.isDialogOpen()) {
    switch (action) {
      case 'left':
      case 'right':
        ui.dialogNavigate(action === 'right' ? 1 : -1);
        break;
      case 'up':
      case 'down':
        ui.dialogNavigate(action === 'down' ? 1 : -1);
        break;
      case 'select':
        ui.dialogSelect();
        break;
      case 'back':
        ui.hideConfirmDialog();
        break;
      default:
        break;
    }
    return;
  }

  if (settings.isVisible()) {
    switch (action) {
      case 'up':
        settings.navigate(-1);
        break;
      case 'down':
        settings.navigate(1);
        break;
      case 'left':
        settings.navigateNav(-1);
        break;
      case 'right':
        settings.navigateNav(1);
        break;
      case 'select':
        settings.selectFocused();
        break;
      case 'back':
        settings.hide();
        deps.refreshProxyMenu();
        ui.refreshGroupVisibility();
        state.selectedGroup = ui.getSelectedGroup();
        // BUG-018: with no playlist yet, initialize the empty shell so the
        // sidebars and Settings stay reachable.
        if (state.channels && state.channels.length > 0) {
          deps.showPlayer();
        } else {
          deps.startPlayer();
        }
        ui.stopInactivityTimer();
        break;
      default:
        break;
    }
    return;
  }

  if (ui.isRightSidebarOpen()) {
    handleRightSidebarAction(action);
    return;
  }

  if (ui.isSidebarOpen()) {
    handleSidebarAction(action, value);
    return;
  }

  // A feature may own an action outright (e.g. a reserved key). Routes run
  // only after modal/settings/sidebar precedence, so those views stay intact.
  if (dispatchFeatureRoute(action, value)) return;

  handlePlayerViewAction(action, value);
}

// Self-register so the hub and sibling slices reach these through slots.
Object.assign(deps, {
  handleRemoteAction,
  registerTizenKeys,
  zapChannel,
});
