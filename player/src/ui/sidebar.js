// Group list, group navigation and group visibility (T-133). ui.js re-exports
// the public names so callers keep using ui.*. Calls into the channel core go
// through deps.js (wired by ui.js at boot), so this slice never imports the
// re-export hub and no import cycle is created.

import { escapeHtml } from '../utils.js';
import { getHiddenGroups } from '../config.js';
import { state } from './state.js';
import { deps } from './deps.js';
import { enterSearch } from './search.js';
import { enterLibrary } from './library.js';

export function extractGroups(channelList) {
  const hidden = getHiddenGroups();
  const visible = (channelList || []).filter((ch) => !hidden.includes((ch && ch.group) || 'Ungrouped'));
  const groupMap = {};
  for (const ch of visible) {
    const g = ch.group || 'Ungrouped';
    if (!groupMap[g]) groupMap[g] = [];
    groupMap[g].push(ch);
  }
  const realGroups = Object.keys(groupMap)
    .sort()
    .map((name) => ({
      name,
      count: groupMap[name].length,
      channels: groupMap[name],
    }));
  state.groups = [{ name: 'All Channels', count: visible.length, channels: visible }, ...realGroups];
}

export function getSidebarMode() {
  return state.sidebarMode;
}

export function getGroups() {
  return state.groups;
}

export function getSelectedGroup() {
  return state.selectedGroup;
}

export function updateSidebarTitle() {
  const el = document.getElementById('sidebar-title');
  if (!el) return;
  if (state.sidebarMode === 'search') {
    el.textContent = 'Search';
  } else if (state.sidebarMode === 'groups') {
    el.textContent = 'Groups';
  } else if (state.selectedGroup === 'all') {
    el.textContent = 'All Channels';
  } else if (state.selectedGroup) {
    el.textContent = state.selectedGroup;
  } else {
    el.textContent = 'Channels';
  }
}

export function renderGroupList() {
  const container = document.getElementById('group-list');
  if (!container) return;
  container.innerHTML = '';
  const searchRow = document.createElement('div');
  searchRow.className = 'group-item';
  searchRow.dataset.search = '1';
  searchRow.innerHTML = '<span class="group-name">🔍 Search</span>';
  searchRow.addEventListener('click', () => {
    enterSearch();
  });
  container.appendChild(searchRow);
  const libraryRow = document.createElement('div');
  libraryRow.className = 'group-item';
  libraryRow.dataset.library = '1';
  libraryRow.innerHTML = '<span class="group-name">🎬 Library</span>';
  libraryRow.addEventListener('click', () => {
    enterLibrary();
  });
  container.appendChild(libraryRow);
  state.groups.forEach((group, index) => {
    const item = document.createElement('div');
    item.className = 'group-item';
    item.dataset.index = index;
    item.innerHTML =
      '<span class="group-name">' +
      escapeHtml(group.name) +
      '</span>' +
      '<span class="group-count">(' +
      group.count +
      ')</span>';
    item.addEventListener('click', () => {
      showGroupChannels(group.name);
    });
    container.appendChild(item);
  });
  updateGroupFocus();
}

export function updateGroupFocus() {
  const items = document.querySelectorAll('#group-list .group-item');
  items.forEach((item, idx) => {
    item.classList.toggle('focused', idx === state.groupFocusedIndex);
  });
  if (items[state.groupFocusedIndex]) {
    // Instant + minimal scroll: smooth queues animations on key-repeat (hold)
    // and the focus runs ahead of the visible scroll position; re-centering
    // on every step makes the list jump so the eye can't track focus.
    // Nearest keeps the focused row steadily in view, one step at a time.
    items[state.groupFocusedIndex].scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
}

export function navigateGroupUp() {
  const total = state.groups.length + 2; // + Search and Library rows
  if (total === 0) return;
  state.groupFocusedIndex = (state.groupFocusedIndex - 1 + total) % total;
  updateGroupFocus();
}

export function navigateGroupDown() {
  const total = state.groups.length + 2; // + Search and Library rows
  if (total === 0) return;
  state.groupFocusedIndex = (state.groupFocusedIndex + 1) % total;
  updateGroupFocus();
}

export function selectFocusedGroup() {
  if (state.groupFocusedIndex === 0) {
    enterSearch();
    return;
  }
  if (state.groupFocusedIndex === 1) {
    enterLibrary();
    return;
  }
  const group = state.groups[state.groupFocusedIndex - 2];
  if (group) showGroupChannels(group.name);
}

export function showGroupChannels(groupName) {
  state.selectedGroup = groupName === 'All Channels' ? 'all' : groupName;
  state.sidebarMode = 'channels';
  state.focusedIndex = 0;
  const groupList = document.getElementById('group-list');
  const channelList = document.getElementById('channel-list');
  if (groupList) groupList.classList.add('hidden');
  if (channelList) channelList.classList.remove('hidden');
  deps.renderChannelList();
  deps.updateSidebarTitle();
  deps.updateFocus();
}

export function showGroupList() {
  state.sidebarMode = 'groups';
  const groupList = document.getElementById('group-list');
  const channelList = document.getElementById('channel-list');
  if (channelList) channelList.classList.add('hidden');
  if (groupList) groupList.classList.remove('hidden');
  renderGroupList();
  updateSidebarTitle();
}

/* Re-derive groups after the hidden-groups setting changes, preserving the
   playing mark and focus. Falls back to the group list when the open group
   was just hidden. */
export function refreshGroupVisibility() {
  if (state.sidebarMode === 'search') {
    state.searchResults = deps.computeSearchResults();
    deps.renderSearchResults();
    return;
  }
  extractGroups(state.channels);
  const hidden = getHiddenGroups();
  if (
    state.sidebarMode === 'groups' ||
    (state.selectedGroup && state.selectedGroup !== 'all' && hidden.includes(state.selectedGroup))
  ) {
    state.selectedGroup = null;
    showGroupList();
  } else {
    deps.renderChannelList();
    updateSidebarTitle();
    deps.updateFocus();
  }
}

// Wire the group callbacks the search slice calls through.
deps.renderGroupList = renderGroupList;
deps.updateSidebarTitle = updateSidebarTitle;
