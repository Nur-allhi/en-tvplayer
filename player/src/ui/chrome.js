// UI chrome (T-135): sidebar toggle, fullscreen, cursor auto-hide and the
// inactivity timer. Calls into the channel core go through deps.js so this
// slice never imports core.js (which would be a cycle).

import { state } from './state.js';
import { deps } from './deps.js';
import { showGroupList, updateSidebarTitle } from './sidebar.js';
import { applyRightSidebar } from './right-menu.js';

export function toggleSidebar() {
  if (state.rightSidebarOpen) {
    state.rightSidebarOpen = false;
    applyRightSidebar();
  }
  state.sidebarOpen = !state.sidebarOpen;
  if (state.sidebarOpen) {
    if (state.groups.length > 0 && state.selectedGroup !== null) {
      state.sidebarMode = 'channels';
      const displayChannels = deps.getDisplayChannels();
      const playingChannel = state.channels[state.currentIndex];
      const idx = playingChannel ? displayChannels.indexOf(playingChannel) : -1;
      state.focusedIndex = idx >= 0 ? idx : 0;
      const groupList = document.getElementById('group-list');
      const channelList = document.getElementById('channel-list');
      if (groupList) groupList.classList.add('hidden');
      if (channelList) channelList.classList.remove('hidden');
      deps.renderChannelList();
      deps.updateFocus();
    } else if (state.groups.length > 0) {
      showGroupList();
    } else {
      state.selectedGroup = null;
      state.sidebarMode = 'channels';
      state.focusedIndex = state.currentIndex >= 0 ? state.currentIndex : 0;
      deps.renderChannelList();
    }
    updateSidebarTitle();
  }
  applySidebar();
}

export function closeAllOverlays() {
  if (state.sidebarOpen) {
    state.sidebarOpen = false;
    applySidebar();
  }
  if (state.rightSidebarOpen) {
    state.rightSidebarOpen = false;
    applyRightSidebar();
  }
}

export function isSidebarOpen() {
  return state.sidebarOpen;
}

export function showSidebarWithContent() {
  state.sidebarOpen = true;
  applySidebar();
}

export function isFullscreenMode() {
  return state.isFullscreen;
}

export function requestFullscreen() {
  const app = document.getElementById('app');
  if (app) {
    app.classList.add('fullscreen');
  }
  state.isFullscreen = true;
  state.sidebarOpen = false;
  applySidebar();
  state.rightSidebarOpen = false;
  applyRightSidebar();

  startCursorAutoHide();
  startInactivityTimer();

  const target = app || document.documentElement;
  if (target && !document.fullscreenElement && target.requestFullscreen) {
    const result = target.requestFullscreen();
    if (result && result.catch) {
      result.catch(() => {});
    }
  }
}

export function exitFullscreenMode() {
  state.isFullscreen = false;
  state.sidebarOpen = true;
  state.rightSidebarOpen = false;
  const app = document.getElementById('app');
  if (app) {
    app.classList.remove('fullscreen');
    app.classList.remove('show-cursor');
  }
  stopCursorAutoHide();
  stopInactivityTimer();
  applySidebar();
  applyRightSidebar();
}

let cursorHideTimer = null;

function startCursorAutoHide() {
  document.addEventListener('mousemove', onFullscreenMouseMove);
  revealCursor();
}

export function stopCursorAutoHide() {
  document.removeEventListener('mousemove', onFullscreenMouseMove);
  clearTimeout(cursorHideTimer);
}

function onFullscreenMouseMove() {
  revealCursor();
}

function revealCursor() {
  const app = document.getElementById('app');
  if (app) app.classList.add('show-cursor');
  clearTimeout(cursorHideTimer);
  cursorHideTimer = setTimeout(() => {
    const a = document.getElementById('app');
    if (a) a.classList.remove('show-cursor');
  }, 1700);
}

let inactivityTimer = null;
let autoCloseCallback = null;
const INACTIVITY_MS = 8000;

export function startInactivityTimer() {
  document.addEventListener('mousemove', resetInactivity);
  document.addEventListener('keydown', resetInactivity);
  document.addEventListener('click', resetInactivity);
  resetInactivity();
}

export function stopInactivityTimer() {
  document.removeEventListener('mousemove', resetInactivity);
  document.removeEventListener('keydown', resetInactivity);
  document.removeEventListener('click', resetInactivity);
  clearTimeout(inactivityTimer);
}

function resetInactivity() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(autoCloseOverlays, INACTIVITY_MS);
}

function autoCloseOverlays() {
  const sidebarHasFocus = state.sidebarOpen && document.querySelector('#sidebar .focused, #sidebar [data-focused]');
  const rightHasFocus =
    state.rightSidebarOpen && document.querySelector('#right-sidebar .focused, #right-sidebar [data-focused]');
  if (sidebarHasFocus || rightHasFocus) {
    resetInactivity();
    return;
  }
  if (autoCloseCallback) {
    autoCloseCallback();
  }
  if (state.sidebarOpen) {
    state.sidebarOpen = false;
    applySidebar();
  }
  if (state.rightSidebarOpen) {
    state.rightSidebarOpen = false;
    applyRightSidebar();
  }
}

export function resetInactivityTimer() {
  resetInactivity();
}

function applySidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.toggle('closed', !state.sidebarOpen);
  }
  deps.applyWatermark();
}

export function setAutoCloseCallback(callback) {
  autoCloseCallback = callback;
}

// Wire the chrome callbacks other slices call through.
deps.applySidebar = applySidebar;
deps.resetInactivity = resetInactivity;
deps.requestFullscreen = requestFullscreen;
