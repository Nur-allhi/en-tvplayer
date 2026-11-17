// Channel-list core (T-135): init, virtualised rendering, navigation and
// selection. ui/index.js re-exports these names. Slices reached from here are
// imported one-way; calls back from them come through deps.js, wired locally.

import { escapeHtml } from '../utils.js';
import { getHiddenGroups, getSettings } from '../config.js';
import { filterDisplayChannels } from '../logic.js';
import { FAVORITES_GROUP, filterFavorites } from '../lib/favorites.js';
import { state } from './state.js';
import { deps } from './deps.js';
import { extractGroups, renderGroupList, updateSidebarTitle } from './sidebar.js';
import { applyRightSidebar } from './right-menu.js';

const VIRTUAL_SIZE = 30;

let onChannelSelect = null;
export function init(channelList, callback) {
  state.channels = channelList;
  onChannelSelect = callback;
  state.currentIndex = -1;
  state.focusedIndex = 0;

  extractGroups(state.channels);
  if (state.groups.length > 0) {
    state.sidebarMode = 'groups';
    state.selectedGroup = null;
    renderGroupList();
  } else {
    state.sidebarMode = 'channels';
    state.selectedGroup = null;
    renderChannelList();
  }
  updateSidebarTitle();
  deps.updateFocus();

  // In fullscreen, reveal the sidebar when the mouse enters the left edge
  const hoverZone = document.getElementById('sidebar-hover-zone');
  const sidebar = document.getElementById('sidebar');
  if (hoverZone) {
    hoverZone.addEventListener('mouseenter', () => {
      if (state.isFullscreen) {
        if (state.rightSidebarOpen) {
          state.rightSidebarOpen = false;
          applyRightSidebar();
        }
        state.sidebarOpen = true;
        deps.applySidebar();
        deps.resetInactivity();
      }
    });
  }
  if (sidebar) {
    sidebar.addEventListener('mouseleave', () => {
      if (state.isFullscreen && !state.rightSidebarOpen) {
        state.sidebarOpen = false;
        deps.applySidebar();
      }
    });
  }

  // In fullscreen, reveal the right sidebar when the mouse enters the right edge
  const rightZone = document.getElementById('right-hover-zone');
  const rightSidebarEl = document.getElementById('right-sidebar');
  if (rightZone) {
    rightZone.addEventListener('mouseenter', () => {
      if (state.isFullscreen) {
        if (state.sidebarOpen) {
          state.sidebarOpen = false;
          deps.applySidebar();
        }
        state.rightSidebarOpen = true;
        applyRightSidebar();
        deps.resetInactivity();
      }
    });
  }
  if (rightSidebarEl) {
    rightSidebarEl.addEventListener('mouseleave', (e) => {
      if (!state.isFullscreen) return;
      const to = e.relatedTarget;
      if (to && rightZone && rightZone.contains(to)) return;
      state.rightSidebarOpen = false;
      applyRightSidebar();
    });
  }
}

export function getCurrentIndex() {
  return state.currentIndex;
}

export function renderChannelList() {
  const container = document.getElementById('channel-list');
  if (!container) return;

  let displayChannels;
  if (state.selectedGroup === 'all' || !state.selectedGroup) {
    displayChannels = state.channels;
  } else {
    displayChannels = state.channels.filter((ch) => (ch.group || 'Ungrouped') === state.selectedGroup);
  }

  const total = displayChannels.length;
  if (total > VIRTUAL_SIZE) {
    const half = Math.floor(VIRTUAL_SIZE / 2);
    state.virtualStart = Math.max(0, state.focusedIndex - half);
    state.virtualEnd = Math.min(total, state.virtualStart + VIRTUAL_SIZE);
    if (state.virtualEnd - state.virtualStart < VIRTUAL_SIZE)
      state.virtualStart = Math.max(0, state.virtualEnd - VIRTUAL_SIZE);
  } else {
    state.virtualStart = 0;
    state.virtualEnd = total;
  }

  container.innerHTML = '';

  for (let displayIndex = state.virtualStart; displayIndex < state.virtualEnd; displayIndex++) {
    const channel = displayChannels[displayIndex];
    const originalIndex = state.channels.indexOf(channel);
    const item = document.createElement('div');
    item.className = 'channel-item';
    item.dataset.index = displayIndex;

    item.innerHTML =
      '<span class="channel-number">' +
      (displayIndex + 1) +
      '</span>' +
      '<span class="channel-name"><span class="channel-name-text">' +
      escapeHtml(channel.name) +
      '</span></span>';

    item.addEventListener('click', () => {
      selectChannel(originalIndex);
    });

    container.appendChild(item);
  }
  // Windowed rendering would reset the scroll to the top on every rebuild.
  // Spacers stand in for the off-screen rows so the list keeps its full
  // height, then the scroll is restored exactly — window shifts are invisible.
  const stride = channelRowStride(container);
  if (stride > 0) {
    const top = document.createElement('div');
    top.style.height = state.virtualStart * stride + 'px';
    container.prepend(top);
    const bottom = document.createElement('div');
    bottom.style.height = Math.max(0, total - state.virtualEnd) * stride + 'px';
    container.appendChild(bottom);
    const target =
      state.virtualStart * stride +
      (state.focusedIndex - state.virtualStart) * stride -
      (container.clientHeight - stride) / 2;
    container.scrollTop = Math.max(0, target);
  }
  container.dataset.virtualStart = state.virtualStart;
  container.dataset.virtualEnd = state.virtualEnd;
  deps.updateActiveChannel();
}

// Uniform row pitch (row + its vertical margins), measured live so scaling
// and fonts can't drift the virtual scroll math.
function channelRowStride(container) {
  const row = container ? container.querySelector('.channel-item') : null;
  if (!row || !row.offsetHeight) return 0;
  const cs = getComputedStyle(row);
  return row.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
}

export function selectChannel(index, skipFullscreen) {
  if (index < 0 || index >= state.channels.length) return;

  state.currentIndex = index;
  const displayChannels = getDisplayChannels();
  state.focusedIndex = displayChannels.indexOf(state.channels[index]);
  if (state.focusedIndex < 0) state.focusedIndex = 0;
  if (state.focusedIndex < state.virtualStart || state.focusedIndex >= state.virtualEnd) {
    renderChannelList();
  }
  deps.updateActiveChannel();
  deps.updateFocus();

  if (onChannelSelect) {
    onChannelSelect(state.channels[index]);
  }

  if (!skipFullscreen) {
    deps.requestFullscreen();
  }

  const nameEl = document.getElementById('channel-name');
  const infoEl = document.getElementById('channel-info');

  if (nameEl) {
    nameEl.textContent = state.channels[index].name;
  }

  if (infoEl) {
    const ext = state.channels[index].url.split('.').pop().split('?')[0];
    infoEl.textContent = ext.toUpperCase();
  }
}

export function navigateUp() {
  const displayChannels = getDisplayChannels();
  if (displayChannels.length === 0) return;
  state.focusedIndex = (state.focusedIndex - 1 + displayChannels.length) % displayChannels.length;
  if (state.focusedIndex < state.virtualStart || state.focusedIndex >= state.virtualEnd) {
    renderChannelList();
  }
  deps.updateFocus();
  deps.scrollToFocused();
}

export function navigateDown() {
  const displayChannels = getDisplayChannels();
  if (displayChannels.length === 0) return;
  state.focusedIndex = (state.focusedIndex + 1) % displayChannels.length;
  if (state.focusedIndex < state.virtualStart || state.focusedIndex >= state.virtualEnd) {
    renderChannelList();
  }
  deps.updateFocus();
  deps.scrollToFocused();
}

export function selectFocused() {
  const displayChannels = getDisplayChannels();
  const channel = displayChannels[state.focusedIndex];
  if (channel) {
    selectChannel(state.channels.indexOf(channel));
  }
}

export function getDisplayChannels() {
  if (state.selectedGroup === FAVORITES_GROUP) {
    return filterFavorites(state.channels, getSettings().favorites);
  }
  return filterDisplayChannels(state.channels, getHiddenGroups(), state.selectedGroup);
}

export function jumpToNumber(num, skipFullscreen) {
  const displayChannels = getDisplayChannels();
  const channel = displayChannels.find((ch) => ch.channelNumber === num);
  if (channel) {
    selectChannel(state.channels.indexOf(channel), skipFullscreen);
  }
}

// Wire the core callbacks other slices call through.
deps.renderChannelList = renderChannelList;
deps.getDisplayChannels = getDisplayChannels;
deps.selectChannel = selectChannel;
