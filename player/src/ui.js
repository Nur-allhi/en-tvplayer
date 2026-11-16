import { escapeHtml } from './utils.js';
import { getHiddenGroups } from './config.js';
import { filterDisplayChannels } from './logic.js';
import { state } from './ui/state.js';
import { applyWatermark } from './ui/osd.js';
import { deps } from './ui/deps.js';
import { extractGroups, renderGroupList, showGroupList, updateSidebarTitle } from './ui/sidebar.js';

// Wire the cross-slice callbacks (T-133) before any slice function can run.
// Function declarations below are hoisted; imported bindings are live.
deps.renderChannelList = renderChannelList;
deps.updateFocus = updateFocus;
deps.selectChannel = selectChannel;
deps.renderGroupList = renderGroupList;
deps.updateSidebarTitle = updateSidebarTitle;

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

/* Sidebar + search slices (T-133) — re-exported for callers. */
export {
  extractGroups,
  getSidebarMode,
  getGroups,
  getSelectedGroup,
  updateSidebarTitle,
  renderGroupList,
  updateGroupFocus,
  navigateGroupUp,
  navigateGroupDown,
  selectFocusedGroup,
  showGroupChannels,
  showGroupList,
  refreshGroupVisibility,
} from './ui/sidebar.js';
export { enterSearch, exitSearch, searchNavigate, searchSelect } from './ui/search.js';

/* Confirm Dialog — extracted to ui/dialogs.js (T-131); re-exported for callers. */
export { isDialogOpen, showConfirmDialog, hideConfirmDialog, dialogNavigate, dialogSelect } from './ui/dialogs.js';

/* OSD slice (T-132) — re-exported for callers. */
export {
  setOverlayVisibility,
  isBadgeVisible,
  showEmptyLogo,
  hideEmptyLogo,
  showChannelOsd,
  showFirstRunHint,
  showTransientNotice,
  setBufferingChannel,
  resetTuneStatus,
  setTuneAttempt,
  showChannelToast,
  showBuffering,
  updateBuffering,
  hideBuffering,
} from './ui/osd.js';
