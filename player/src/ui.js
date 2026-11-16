import { escapeHtml } from './utils.js';
import { getHiddenGroups } from './config.js';
import { filterDisplayChannels, slowHintFor, attemptSuffix } from './logic.js';
import { state } from './ui/state.js';

// Shared UI state lives in ./ui/state.js (T-130). Every upcoming ui/ slice
// imports the same object, so no slice can silently keep its own copy.
// Slice-local values (callbacks, constants) stay here.

const VIRTUAL_SIZE = 30;

let onChannelSelect = null;
let rightSelectedResolution = 'auto';
let rightResolutionCallback = null;

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
  updateFocus();

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
        applySidebar();
        resetInactivity();
      }
    });
  }
  if (sidebar) {
    sidebar.addEventListener('mouseleave', () => {
      if (state.isFullscreen && !state.rightSidebarOpen) {
        state.sidebarOpen = false;
        applySidebar();
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
          applySidebar();
        }
        state.rightSidebarOpen = true;
        applyRightSidebar();
        resetInactivity();
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

export function getCurrentIndex() {
  return state.currentIndex;
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
  const total = state.groups.length + 1; // + Search row
  if (total === 0) return;
  state.groupFocusedIndex = (state.groupFocusedIndex - 1 + total) % total;
  updateGroupFocus();
}

export function navigateGroupDown() {
  const total = state.groups.length + 1; // + Search row
  if (total === 0) return;
  state.groupFocusedIndex = (state.groupFocusedIndex + 1) % total;
  updateGroupFocus();
}

export function selectFocusedGroup() {
  if (state.groupFocusedIndex === 0) {
    enterSearch();
    return;
  }
  const group = state.groups[state.groupFocusedIndex - 1];
  if (group) showGroupChannels(group.name);
}

/* Cross-group search (T-037): the pinned Search row opens a text input;
   results span all visible groups (hidden groups excluded). */

const SEARCH_LIMIT = 60;

function getSearchInput() {
  return document.getElementById('channel-search');
}

function isSearchInputFocused() {
  const el = getSearchInput();
  return !!el && document.activeElement === el;
}

function computeSearchResults() {
  const q = state.searchQuery.trim().toLowerCase();
  if (!q) return [];
  const hidden = getHiddenGroups();
  return state.channels.filter(
    (ch) => !hidden.includes((ch && ch.group) || 'Ungrouped') && (ch.name || '').toLowerCase().includes(q),
  );
}

export function enterSearch() {
  state.sidebarMode = 'search';
  state.searchQuery = '';
  state.searchResults = [];
  state.searchFocus = 0;
  renderSearch();
  updateSidebarTitle();
}

export function exitSearch() {
  state.sidebarMode = 'groups';
  state.searchQuery = '';
  state.searchResults = [];
  state.searchFocus = 0;
  const groupList = document.getElementById('group-list');
  const channelList = document.getElementById('channel-list');
  if (channelList) channelList.classList.add('hidden');
  if (groupList) groupList.classList.remove('hidden');
  renderGroupList();
  updateSidebarTitle();
}

function renderSearch() {
  const container = document.getElementById('group-list');
  if (!container) return;
  const channelList = document.getElementById('channel-list');
  if (channelList) channelList.classList.add('hidden');
  container.classList.remove('hidden');
  container.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'search-row';
  const input = document.createElement('input');
  input.id = 'channel-search';
  input.className = 'input-field';
  input.type = 'text';
  input.placeholder = 'Search channels…';
  input.setAttribute('autocomplete', 'off');
  input.value = state.searchQuery;
  input.addEventListener('input', () => {
    state.searchQuery = input.value;
    state.searchResults = computeSearchResults();
    state.searchFocus = 0;
    renderSearchResults();
  });
  row.appendChild(input);
  container.appendChild(row);
  const results = document.createElement('div');
  results.id = 'search-results';
  container.appendChild(results);
  renderSearchResults();
  input.focus();
}

function searchHint(text) {
  const el = document.createElement('div');
  el.className = 'search-hint';
  el.textContent = text;
  return el;
}

function renderSearchResults() {
  const box = document.getElementById('search-results');
  if (!box) return;
  box.innerHTML = '';
  if (!state.searchQuery.trim()) {
    box.appendChild(searchHint('Type to search all groups'));
    return;
  }
  if (state.searchResults.length === 0) {
    box.appendChild(searchHint('No channels found'));
    return;
  }
  state.searchResults.slice(0, SEARCH_LIMIT).forEach((ch, i) => {
    const item = document.createElement('div');
    item.className = 'channel-item search-item';
    item.innerHTML =
      '<span class="channel-name"><span class="channel-name-text">' +
      escapeHtml(ch.name) +
      '</span></span>' +
      '<span class="group-count">' +
      escapeHtml(ch.group || 'Ungrouped') +
      '</span>';
    item.addEventListener('click', () => {
      state.searchFocus = i;
      updateSearchFocus();
      searchSelect();
    });
    box.appendChild(item);
  });
  if (state.searchResults.length > SEARCH_LIMIT) {
    box.appendChild(searchHint('+' + (state.searchResults.length - SEARCH_LIMIT) + ' more — keep typing'));
  }
  updateSearchFocus();
}

function updateSearchFocus() {
  const items = document.querySelectorAll('#search-results .search-item');
  items.forEach((item, i) => item.classList.toggle('focused', i === state.searchFocus));
  if (items[state.searchFocus]) {
    // Instant + minimal scroll: see updateGroupFocus.
    items[state.searchFocus].scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
}

export function searchNavigate(dir) {
  if (isSearchInputFocused()) {
    if (dir > 0 && state.searchResults.length > 0) {
      getSearchInput().blur();
      state.searchFocus = 0;
      updateSearchFocus();
    }
    return;
  }
  if (state.searchResults.length === 0) return;
  state.searchFocus += dir;
  if (state.searchFocus < 0) {
    state.searchFocus = 0;
    const input = getSearchInput();
    if (input) input.focus();
    updateSearchFocus();
    return;
  }
  const shown = Math.min(state.searchResults.length, SEARCH_LIMIT);
  if (state.searchFocus >= shown) state.searchFocus = shown - 1;
  updateSearchFocus();
}

export function searchSelect() {
  if (isSearchInputFocused()) {
    if (state.searchResults.length === 0) return;
    getSearchInput().blur();
    state.searchFocus = 0;
    updateSearchFocus();
    return;
  }
  const ch = state.searchResults[state.searchFocus];
  if (!ch) return;
  const idx = state.channels.indexOf(ch);
  exitSearch();
  if (idx >= 0) selectChannel(idx);
}

export function showGroupChannels(groupName) {
  state.selectedGroup = groupName === 'All Channels' ? 'all' : groupName;
  state.sidebarMode = 'channels';
  state.focusedIndex = 0;
  const groupList = document.getElementById('group-list');
  const channelList = document.getElementById('channel-list');
  if (groupList) groupList.classList.add('hidden');
  if (channelList) channelList.classList.remove('hidden');
  renderChannelList();
  updateSidebarTitle();
  updateFocus();
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
    state.searchResults = computeSearchResults();
    renderSearchResults();
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
    renderChannelList();
    updateSidebarTitle();
    updateFocus();
  }
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
  updateActiveChannel();
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
  updateActiveChannel();
  updateFocus();

  if (onChannelSelect) {
    onChannelSelect(state.channels[index]);
  }

  if (!skipFullscreen) {
    requestFullscreen();
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
  updateFocus();
  scrollToFocused();
}

export function navigateDown() {
  const displayChannels = getDisplayChannels();
  if (displayChannels.length === 0) return;
  state.focusedIndex = (state.focusedIndex + 1) % displayChannels.length;
  if (state.focusedIndex < state.virtualStart || state.focusedIndex >= state.virtualEnd) {
    renderChannelList();
  }
  updateFocus();
  scrollToFocused();
}

export function selectFocused() {
  const displayChannels = getDisplayChannels();
  const channel = displayChannels[state.focusedIndex];
  if (channel) {
    selectChannel(state.channels.indexOf(channel));
  }
}

export function getDisplayChannels() {
  return filterDisplayChannels(state.channels, getHiddenGroups(), state.selectedGroup);
}

export function jumpToNumber(num, skipFullscreen) {
  const displayChannels = getDisplayChannels();
  const channel = displayChannels.find((ch) => ch.channelNumber === num);
  if (channel) {
    selectChannel(state.channels.indexOf(channel), skipFullscreen);
  }
}

export function toggleSidebar() {
  if (state.rightSidebarOpen) {
    state.rightSidebarOpen = false;
    applyRightSidebar();
  }
  state.sidebarOpen = !state.sidebarOpen;
  if (state.sidebarOpen) {
    if (state.groups.length > 0 && state.selectedGroup !== null) {
      state.sidebarMode = 'channels';
      const displayChannels = getDisplayChannels();
      const playingChannel = state.channels[state.currentIndex];
      const idx = playingChannel ? displayChannels.indexOf(playingChannel) : -1;
      state.focusedIndex = idx >= 0 ? idx : 0;
      const groupList = document.getElementById('group-list');
      const channelList = document.getElementById('channel-list');
      if (groupList) groupList.classList.add('hidden');
      if (channelList) channelList.classList.remove('hidden');
      renderChannelList();
      updateFocus();
    } else if (state.groups.length > 0) {
      showGroupList();
    } else {
      state.selectedGroup = null;
      state.sidebarMode = 'channels';
      state.focusedIndex = state.currentIndex >= 0 ? state.currentIndex : 0;
      renderChannelList();
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
  applyWatermark();
}

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

/* Right sidebar */
export function applyRightSidebar() {
  const el = document.getElementById('right-sidebar');
  if (el) {
    el.classList.toggle('closed', !state.rightSidebarOpen);
  }
}

export function setAutoCloseCallback(callback) {
  autoCloseCallback = callback;
}

export function toggleRightSidebar() {
  if (state.sidebarOpen) {
    state.sidebarOpen = false;
    applySidebar();
  }
  state.rightSidebarOpen = !state.rightSidebarOpen;
  applyRightSidebar();
  if (state.rightSidebarOpen) {
    qualityOpen = false;
    audioOpen = false;
    renderRightResolutionList();
    renderAudioList();
    buildRightItems();
    state.rightFocus = 0;
    updateRightFocus();
    resetInactivity();
  }
}

export function isRightSidebarOpen() {
  return state.rightSidebarOpen;
}

export function setResolutionCallback(cb) {
  rightResolutionCallback = cb;
}

function clampRightFocus() {
  if (state.rightItems.length === 0) {
    state.rightFocus = 0;
    return;
  }
  if (state.rightFocus < 0) state.rightFocus = 0;
  if (state.rightFocus >= state.rightItems.length) state.rightFocus = state.rightItems.length - 1;
}

export function setResolutions(heights) {
  state.rightResolutions = ['auto'].concat(heights || []);
  renderRightResolutionList();
  if (state.rightSidebarOpen) {
    buildRightItems();
    clampRightFocus();
    updateRightFocus();
  }
}

export function setSelectedResolution(value) {
  rightSelectedResolution = value;
  renderRightResolutionList();
  if (state.rightSidebarOpen) {
    buildRightItems();
    clampRightFocus();
    updateRightFocus();
  }
}

/* Multi-audio tracks (languages, commentary, …). Same row treatment as
   quality; the whole section hides when a channel offers < 2 tracks. */
let rightAudios = [];
let rightSelectedAudioId = null;
let rightAudioCallback = null;

export function setAudioCallback(cb) {
  rightAudioCallback = cb;
}

export function setAudioTracks(tracks) {
  rightAudios = tracks || [];
  if (rightSelectedAudioId == null || !rightAudios.some((t) => t.id === rightSelectedAudioId)) {
    const active = rightAudios.find((t) => t.active);
    rightSelectedAudioId = active ? active.id : rightAudios[0] ? rightAudios[0].id : null;
  }
  renderAudioList();
  if (state.rightSidebarOpen) {
    buildRightItems();
    clampRightFocus();
    updateRightFocus();
  }
}

export function setSelectedAudio(id) {
  rightSelectedAudioId = id;
  renderAudioList();
  if (state.rightSidebarOpen) {
    buildRightItems();
    clampRightFocus();
    updateRightFocus();
  }
}

function audioTrackLabel(track, index) {
  if (track.label) return track.label;
  if (track.language) return track.language;
  return 'Track ' + (index + 1);
}

function renderAudioList() {
  const section = document.getElementById('audio-section-right');
  const list = document.getElementById('audio-list-right');
  if (!list) return;
  const show = rightAudios.length > 1;
  if (section) section.classList.toggle('hidden', !show);
  list.classList.toggle('hidden', !show);
  list.innerHTML = '';
  if (!show) return;
  const header = document.createElement('button');
  header.className = 'right-sidebar-btn dropdown-header';
  header.type = 'button';
  header.textContent = audioHeaderLabel();
  header.addEventListener('click', () => {
    setAudioOpen(!audioOpen);
  });
  list.appendChild(header);
  if (!audioOpen) return;
  rightAudios.forEach((track, index) => {
    const item = document.createElement('div');
    item.className = 'resolution-item-right audio-item-right';
    if (track.id === rightSelectedAudioId) {
      item.classList.add('active');
    }
    item.textContent = audioTrackLabel(track, index);
    item.addEventListener('click', () => {
      const at = state.rightItems.findIndex((it) => it.element === item);
      state.rightFocus = at >= 0 ? at : state.rightFocus;
      doRightSelect();
    });
    list.appendChild(item);
  });
}

function selectAudioById(id) {
  rightSelectedAudioId = id;
  qualityOpen = false;
  audioOpen = false;
  renderRightResolutionList();
  renderAudioList();
  if (rightAudioCallback) {
    rightAudioCallback(id);
  }
  state.rightSidebarOpen = false;
  applyRightSidebar();
}

/* Quality + Audio dropdowns: headers always show, options expand in place.
   Only one dropdown opens at a time; both start closed on menu open. */
let qualityOpen = false;
let audioOpen = false;

function qualityHeaderLabel() {
  const sel = rightSelectedResolution;
  return 'Quality: ' + (sel === 'auto' ? 'Auto' : sel + 'p') + (qualityOpen ? ' ▲' : ' ▼');
}

function renderRightResolutionList() {
  const list = document.getElementById('resolution-list-right');
  if (!list) return;
  list.innerHTML = '';
  const header = document.createElement('button');
  header.className = 'right-sidebar-btn dropdown-header';
  header.type = 'button';
  header.textContent = qualityHeaderLabel();
  header.addEventListener('click', () => {
    setQualityOpen(!qualityOpen);
  });
  list.appendChild(header);
  if (!qualityOpen) return;
  state.rightResolutions.forEach((res) => {
    const item = document.createElement('div');
    item.className = 'resolution-item-right';
    if (res === rightSelectedResolution) {
      item.classList.add('active');
    }
    item.textContent = res === 'auto' ? 'Auto' : res + 'p';
    item.addEventListener('click', () => {
      const at = state.rightItems.findIndex((it) => it.element === item);
      state.rightFocus = at >= 0 ? at : state.rightFocus;
      doRightSelect();
    });
    list.appendChild(item);
  });
}

function setQualityOpen(open) {
  qualityOpen = open;
  if (open) audioOpen = false;
  renderRightResolutionList();
  renderAudioList();
  buildRightItems();
  state.rightFocus = 0; // quality header leads the menu
  updateRightFocus();
  resetInactivity();
}

function audioHeaderLabel() {
  const current = rightAudios.find((t) => t.id === rightSelectedAudioId);
  const name = current ? audioTrackLabel(current, rightAudios.indexOf(current)) : 'Default';
  return 'Audio: ' + name + (audioOpen ? ' ▲' : ' ▼');
}

function setAudioOpen(open) {
  audioOpen = open;
  if (open) qualityOpen = false;
  renderRightResolutionList();
  renderAudioList();
  buildRightItems();
  const at = state.rightItems.findIndex((it) => it.type === 'audio-header');
  state.rightFocus = at >= 0 ? at : state.rightFocus;
  updateRightFocus();
  resetInactivity();
}

function buildRightItems() {
  state.rightItems = [];
  // Quality dropdown: header always, options only while open
  const list = document.getElementById('resolution-list-right');
  if (list) {
    Array.from(list.children).forEach((child) => {
      if (child.classList.contains('dropdown-header')) {
        state.rightItems.push({ type: 'quality-header', element: child });
      } else {
        state.rightItems.push({ type: 'resolution', element: child });
      }
    });
  }
  // Audio dropdown follows quality (skipped while the section hides)
  const audioList = document.getElementById('audio-list-right');
  if (audioList && !audioList.classList.contains('hidden')) {
    let audioIndex = 0;
    Array.from(audioList.children).forEach((child) => {
      if (child.classList.contains('dropdown-header')) {
        state.rightItems.push({ type: 'audio-header', element: child });
      } else {
        const id = rightAudios[audioIndex] ? rightAudios[audioIndex].id : null;
        state.rightItems.push({ type: 'audio', element: child, audioId: id });
        audioIndex++;
      }
    });
  }
  // Button IDs
  const btnIds = ['refresh-stream-btn', 'refresh-channels-btn', 'settings-btn', 'proxy-toggle-btn'];
  btnIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) {
      state.rightItems.push({ type: 'button', element: el, id: id });
    }
  });
}

export function rightSidebarNavigateUp() {
  if (!state.rightSidebarOpen || state.rightItems.length === 0) return;
  state.rightFocus = (state.rightFocus - 1 + state.rightItems.length) % state.rightItems.length;
  updateRightFocus();
}

export function rightSidebarNavigateDown() {
  if (!state.rightSidebarOpen || state.rightItems.length === 0) return;
  state.rightFocus = (state.rightFocus + 1) % state.rightItems.length;
  updateRightFocus();
}

export function rightSidebarSelect() {
  if (!state.rightSidebarOpen || state.rightItems.length === 0) return;
  const item = state.rightItems[state.rightFocus];
  if (!item) return;
  if (item.type === 'quality-header') {
    setQualityOpen(!qualityOpen);
  } else if (item.type === 'audio-header') {
    setAudioOpen(!audioOpen);
  } else if (item.type === 'resolution' || item.type === 'audio') {
    doRightSelect();
  } else if (item.type === 'button') {
    const el = document.getElementById(item.id);
    if (el) el.click();
  }
}

function doRightSelect() {
  const item = state.rightItems[state.rightFocus];
  if (!item) return;
  if (item.type === 'audio') {
    selectAudioById(item.audioId);
    return;
  }
  if (item.type !== 'resolution') {
    // Focus is on a header or button, not a quality option - do nothing
    return;
  }
  const options = state.rightItems.map((it, idx) => ({ it, idx })).filter(({ it }) => it.type === 'resolution');
  const optIndex = options.findIndex(({ idx }) => idx === state.rightFocus);
  if (optIndex < 0 || optIndex >= state.rightResolutions.length) return;
  const value = state.rightResolutions[optIndex];
  rightSelectedResolution = value;
  qualityOpen = false;
  renderRightResolutionList();
  renderAudioList();
  if (rightResolutionCallback) {
    rightResolutionCallback(value === 'auto' ? null : value);
  }
  state.rightSidebarOpen = false;
  applyRightSidebar();
}

function updateRightFocus() {
  state.rightItems.forEach((item, index) => {
    const focused = index === state.rightFocus;
    if (item.element) {
      item.element.classList.toggle('focused', focused);
    }
  });
  if (state.rightItems[state.rightFocus] && state.rightItems[state.rightFocus].element) {
    // Instant + centered: see updateGroupFocus.
    state.rightItems[state.rightFocus].element.scrollIntoView({ block: 'center', behavior: 'auto' });
  }
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

export function getChannels() {
  return state.channels;
}

export function getCurrentChannel() {
  if (state.currentIndex >= 0 && state.currentIndex < state.channels.length) {
    return state.channels[state.currentIndex];
  }
  return null;
}

export function refreshChannelList(newChannels) {
  // Preserve the playing mark across playlist refreshes: match by URL
  // (stable across re-fetch/re-sort); resets when the channel is gone.
  const playingUrl =
    state.currentIndex >= 0 && state.currentIndex < state.channels.length && state.channels[state.currentIndex]
      ? state.channels[state.currentIndex].url
      : null;
  state.channels = newChannels;
  state.currentIndex = playingUrl ? newChannels.findIndex((ch) => ch && ch.url === playingUrl) : -1;
  state.focusedIndex = 0;
  extractGroups(state.channels);
  if (state.selectedGroup === 'all') {
    state.sidebarMode = 'channels';
  } else if (state.selectedGroup && !state.groups.find((g) => g.name === state.selectedGroup)) {
    state.selectedGroup = null;
    state.sidebarMode = 'groups';
  } else if (state.groups.length <= 1) {
    state.sidebarMode = 'channels';
    state.selectedGroup = null;
  }
  if (state.sidebarMode === 'groups') {
    showGroupList();
  } else {
    const groupList = document.getElementById('group-list');
    if (groupList) groupList.classList.add('hidden');
    const channelList = document.getElementById('channel-list');
    if (channelList) channelList.classList.remove('hidden');
    renderChannelList();
    updateSidebarTitle();
  }
  updateFocus();
  updateActiveChannel();
  // Close right sidebar since channel list may have changed
  if (state.rightSidebarOpen) {
    state.rightSidebarOpen = false;
    applyRightSidebar();
  }
}

function updateActiveChannel() {
  const items = document.querySelectorAll('.channel-item');
  const displayChannels = getDisplayChannels();
  const playingDisplayIdx = displayChannels.indexOf(state.channels[state.currentIndex]);
  items.forEach((item) => {
    const idx = parseInt(item.dataset.index, 10);
    item.classList.toggle('active', idx === playingDisplayIdx);
  });
}

let marqueeAnimation = null;
let marqueeNameEl = null;

function startMarquee(textEl) {
  stopMarquee();
  const overflow = textEl.scrollWidth - textEl.parentElement.clientWidth;
  if (overflow <= 0) return;
  const offset = overflow + 20;
  marqueeNameEl = textEl;
  textEl.classList.add('marquee');
  marqueeAnimation = textEl.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(0)', offset: 0.15 },
      { transform: 'translateX(-' + offset + 'px)', offset: 0.45 },
      { transform: 'translateX(-' + offset + 'px)', offset: 0.55 },
      { transform: 'translateX(0)', offset: 0.85 },
      { transform: 'translateX(0)' },
    ],
    {
      duration: 4000,
      iterations: Infinity,
    },
  );
}

function stopMarquee() {
  if (marqueeAnimation) {
    marqueeAnimation.cancel();
    marqueeAnimation = null;
  }
  if (marqueeNameEl) {
    marqueeNameEl.classList.remove('marquee');
    marqueeNameEl = null;
  }
}

function updateFocus() {
  stopMarquee();
  const items = document.querySelectorAll('.channel-item');
  items.forEach((item) => {
    const idx = parseInt(item.dataset.index, 10);
    const nowFocused = idx === state.focusedIndex;
    item.classList.toggle('focused', nowFocused);
    if (nowFocused) {
      const textEl = item.querySelector('.channel-name-text');
      if (textEl) {
        requestAnimationFrame(() => startMarquee(textEl));
      }
    }
  });
}

function scrollToFocused() {
  const el = document.querySelector('.channel-item[data-index="' + state.focusedIndex + '"]');
  if (el) {
    // Instant + minimal scroll: see updateGroupFocus.
    el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
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

/* Update badge on the Settings menu button (gentle, non-blocking) */
export function setUpdateBadge(visible) {
  const btn = document.getElementById('settings-btn');
  if (btn) btn.classList.toggle('has-update', !!visible);
}

/* Desktop test relay label (branch-only): Proxy (test): On/Off */
export function setProxyToggleLabel(on) {
  const btn = document.getElementById('proxy-toggle-btn');
  if (btn) btn.textContent = 'Proxy (test): ' + (on ? 'On' : 'Off');
}

/* Confirm Dialog — extracted to ui/dialogs.js (T-131); re-exported for callers. */
export { isDialogOpen, showConfirmDialog, hideConfirmDialog, dialogNavigate, dialogSelect } from './ui/dialogs.js';
