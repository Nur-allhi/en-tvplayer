// View-specific remote routing for the M5 app split (T-151). Kept separate
// from app/remote.js so both files stay under the 300-LOC cap. It reaches
// zapChannel through its deps slot rather than importing app/remote.js, which
// keeps the import graph one-way (remote.js imports this file, never back).
import { capabilities } from '../capabilities.js';
import * as player from '../player/index.js';
import * as ui from '../ui/index.js';
import { deps } from './deps.js';
import { state } from './state.js';

export function handleRightSidebarAction(action) {
  switch (action) {
    case 'up':
      ui.rightSidebarNavigateUp();
      break;
    case 'down':
      ui.rightSidebarNavigateDown();
      break;
    case 'select':
      ui.rightSidebarSelect();
      break;
    case 'back':
      ui.toggleRightSidebar();
      return;
    case 'left':
      ui.toggleRightSidebar();
      ui.toggleSidebar();
      break;
    case 'right':
      break;
    case 'channelUp':
      ui.toggleRightSidebar();
      deps.zapChannel(1);
      break;
    case 'channelDown':
      ui.toggleRightSidebar();
      deps.zapChannel(-1);
      break;
    default:
      break;
  }
}

export function handleSidebarAction(action, value) {
  const mode = ui.getSidebarMode();
  if (mode === 'search') {
    switch (action) {
      case 'up':
        ui.searchNavigate(-1);
        break;
      case 'down':
        ui.searchNavigate(1);
        break;
      case 'select':
        ui.searchSelect();
        break;
      case 'back':
        ui.exitSearch();
        break;
      case 'number':
        break; // typed into the search box natively
      default:
        break;
    }
    return;
  }
  if (mode === 'library') {
    switch (action) {
      case 'up':
        ui.libraryNavigate(-1);
        break;
      case 'down':
      case 'channelUp':
        ui.libraryNavigate(1);
        break;
      case 'channelDown':
        ui.libraryNavigate(-1);
        break;
      case 'select':
        ui.librarySelect();
        break;
      case 'back':
        ui.libraryBack();
        break;
      case 'left':
      case 'right':
        break;
      default:
        break;
    }
    return;
  }
  if (mode === 'groups') {
    switch (action) {
      case 'up':
        ui.navigateGroupUp();
        break;
      case 'down':
        ui.navigateGroupDown();
        break;
      case 'channelUp':
        ui.navigateGroupDown();
        break;
      case 'channelDown':
        ui.navigateGroupUp();
        break;
      case 'select':
        ui.selectFocusedGroup();
        break;
      case 'left':
        break;
      case 'right':
        ui.toggleSidebar();
        ui.toggleRightSidebar();
        break;
      case 'back':
        ui.toggleSidebar();
        break;
      case 'number':
        ui.jumpToNumber(value);
        break;
      default:
        break;
    }
  } else {
    switch (action) {
      case 'up':
        ui.navigateUp();
        break;
      case 'down':
        ui.navigateDown();
        break;
      case 'channelUp':
        ui.navigateDown();
        break;
      case 'channelDown':
        ui.navigateUp();
        break;
      case 'select':
        ui.selectFocused();
        break;
      case 'left':
        if (ui.getGroups().length > 0) {
          ui.showGroupList();
        } else {
          ui.toggleSidebar();
        }
        break;
      case 'right':
        ui.toggleSidebar();
        ui.toggleRightSidebar();
        break;
      case 'back':
        ui.toggleSidebar();
        break;
      case 'playpause':
        player.togglePlay();
        break;
      case 'number':
        ui.jumpToNumber(value);
        break;
      case 'reload':
        player.reloadChannel();
        break;
      default:
        break;
    }
  }
  state.selectedGroup = ui.getSelectedGroup();
  state.currentIndex = ui.getCurrentIndex();
}

export function handlePlayerViewAction(action, value) {
  switch (action) {
    case 'up':
    case 'prev':
      deps.zapChannel(-1);
      break;
    case 'down':
    case 'next':
    case 'channelUp':
      deps.zapChannel(1);
      break;
    case 'channelDown':
      deps.zapChannel(-1);
      break;
    case 'left':
      ui.toggleSidebar();
      break;
    case 'right':
      ui.toggleRightSidebar();
      break;
    case 'select':
      ui.toggleSidebar();
      break;
    case 'back':
      ui.showConfirmDialog('Exit the app?', (confirmed) => {
        if (confirmed) {
          if (capabilities().hasApplicationControl) {
            try {
              window.tizen.application.getCurrentApplication().exit();
            } catch {}
          } else {
            window.close();
          }
        }
      });
      break;
    case 'playpause':
    case 'play':
    case 'pause':
      player.togglePlay();
      break;
    case 'stop':
      player.stop();
      ui.showEmptyLogo('Playback stopped — pick a channel to watch');
      ui.toggleSidebar();
      break;
    case 'red':
      // Reserved for future use
      break;
    case 'green':
      if (!ui.isSidebarOpen()) {
        ui.toggleSidebar();
      } else if (ui.getSidebarMode() !== 'groups' && ui.getGroups().length > 0) {
        ui.showGroupList();
      }
      break;
    case 'yellow':
      // Reserved for future use
      break;
    case 'blue':
      deps.showSettingsPage();
      break;
    case 'number':
      ui.jumpToNumber(value, true);
      break;
    case 'reload':
      player.reloadChannel();
      break;
    default:
      break;
  }
}
