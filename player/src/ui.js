import { escapeHtml } from './utils.js';

let channels = [];
let currentIndex = -1;
let focusedIndex = 0;
let virtualStart = 0;
let virtualEnd = 0;
const VIRTUAL_SIZE = 30;
let sidebarOpen = false;
let isFullscreen = false;
let onChannelSelect = null;

/* Right sidebar state */
let rightSidebarOpen = false;
let rightResolutions = [];
let rightFocus = 0;
let rightSelectedResolution = 'auto';
let rightResolutionCallback = null;
let rightItems = [];

/* Group sidebar state */
let sidebarMode = 'channels';
let groups = [];
let selectedGroup = null;
let groupFocusedIndex = 0;

export function init(channelList, callback) {
  channels = channelList;
  onChannelSelect = callback;
  currentIndex = -1;
  focusedIndex = 0;

  extractGroups(channels);
  if (groups.length > 0) {
    sidebarMode = 'groups';
    selectedGroup = null;
    renderGroupList();
  } else {
    sidebarMode = 'channels';
    selectedGroup = null;
    renderChannelList();
  }
  updateSidebarTitle();
  updateFocus();

  // In fullscreen, reveal the sidebar when the mouse enters the left edge
  const hoverZone = document.getElementById('sidebar-hover-zone');
  const sidebar = document.getElementById('sidebar');
  if (hoverZone) {
    hoverZone.addEventListener('mouseenter', () => {
      if (isFullscreen) {
        if (rightSidebarOpen) {
          rightSidebarOpen = false;
          applyRightSidebar();
        }
        sidebarOpen = true;
        applySidebar();
        resetInactivity();
      }
    });
  }
  if (sidebar) {
    sidebar.addEventListener('mouseleave', () => {
      if (isFullscreen && !rightSidebarOpen) {
        sidebarOpen = false;
        applySidebar();
      }
    });
  }

  // In fullscreen, reveal the right sidebar when the mouse enters the right edge
  const rightZone = document.getElementById('right-hover-zone');
  const rightSidebarEl = document.getElementById('right-sidebar');
  if (rightZone) {
    rightZone.addEventListener('mouseenter', () => {
      if (isFullscreen) {
        if (sidebarOpen) {
          sidebarOpen = false;
          applySidebar();
        }
        rightSidebarOpen = true;
        applyRightSidebar();
        resetInactivity();
      }
    });
  }
  if (rightSidebarEl) {
    rightSidebarEl.addEventListener('mouseleave', (e) => {
      if (!isFullscreen) return;
      const to = e.relatedTarget;
      if (to && rightZone && rightZone.contains(to)) return;
      rightSidebarOpen = false;
      applyRightSidebar();
    });
  }
}

export function extractGroups(channelList) {
  const groupMap = {};
  for (const ch of channelList) {
    const g = ch.group || 'Ungrouped';
    if (!groupMap[g]) groupMap[g] = [];
    groupMap[g].push(ch);
  }
  const realGroups = Object.keys(groupMap).sort().map(name => ({
    name,
    count: groupMap[name].length,
    channels: groupMap[name],
  }));
  groups = [
    { name: 'All Channels', count: channelList.length, channels: channelList },
    ...realGroups,
  ];
}

export function getSidebarMode() {
  return sidebarMode;
}

export function getGroups() {
  return groups;
}

export function getSelectedGroup() {
  return selectedGroup;
}

export function getCurrentIndex() {
  return currentIndex;
}

export function updateSidebarTitle() {
  const el = document.getElementById('sidebar-title');
  if (!el) return;
  if (sidebarMode === 'groups') {
    el.textContent = 'Groups';
  } else if (selectedGroup === 'all') {
    el.textContent = 'All Channels';
  } else if (selectedGroup) {
    el.textContent = selectedGroup;
  } else {
    el.textContent = 'Channels';
  }
}

export function renderGroupList() {
  const container = document.getElementById('group-list');
  if (!container) return;
  container.innerHTML = '';
  groups.forEach((group, index) => {
    const item = document.createElement('div');
    item.className = 'group-item';
    item.dataset.index = index;
    item.innerHTML =
      '<span class="group-name">' + escapeHtml(group.name) + '</span>' +
      '<span class="group-count">(' + group.count + ')</span>';
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
    item.classList.toggle('focused', idx === groupFocusedIndex);
  });
  if (items[groupFocusedIndex]) {
    items[groupFocusedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

export function navigateGroupUp() {
  if (groups.length === 0) return;
  groupFocusedIndex = (groupFocusedIndex - 1 + groups.length) % groups.length;
  updateGroupFocus();
}

export function navigateGroupDown() {
  if (groups.length === 0) return;
  groupFocusedIndex = (groupFocusedIndex + 1) % groups.length;
  updateGroupFocus();
}

export function selectFocusedGroup() {
  if (groups.length === 0) return;
  showGroupChannels(groups[groupFocusedIndex].name);
}

export function showGroupChannels(groupName) {
  selectedGroup = groupName === 'All Channels' ? 'all' : groupName;
  sidebarMode = 'channels';
  focusedIndex = 0;
  const groupList = document.getElementById('group-list');
  const channelList = document.getElementById('channel-list');
  if (groupList) groupList.classList.add('hidden');
  if (channelList) channelList.classList.remove('hidden');
  renderChannelList();
  updateSidebarTitle();
  updateFocus();
}

export function showGroupList() {
  sidebarMode = 'groups';
  const groupList = document.getElementById('group-list');
  const channelList = document.getElementById('channel-list');
  if (channelList) channelList.classList.add('hidden');
  if (groupList) groupList.classList.remove('hidden');
  renderGroupList();
  updateSidebarTitle();
}

export function renderChannelList() {
  const container = document.getElementById('channel-list');
  if (!container) return;

  let displayChannels;
  if (selectedGroup === 'all' || !selectedGroup) {
    displayChannels = channels;
  } else {
    displayChannels = channels.filter(ch => (ch.group || 'Ungrouped') === selectedGroup);
  }

  const total = displayChannels.length;
  if (total > VIRTUAL_SIZE) {
    const half = Math.floor(VIRTUAL_SIZE / 2);
    virtualStart = Math.max(0, focusedIndex - half);
    virtualEnd = Math.min(total, virtualStart + VIRTUAL_SIZE);
    if (virtualEnd - virtualStart < VIRTUAL_SIZE) virtualStart = Math.max(0, virtualEnd - VIRTUAL_SIZE);
  } else {
    virtualStart = 0;
    virtualEnd = total;
  }

  container.innerHTML = '';

  for (let displayIndex = virtualStart; displayIndex < virtualEnd; displayIndex++) {
    const channel = displayChannels[displayIndex];
    const originalIndex = channels.indexOf(channel);
    const item = document.createElement('div');
    item.className = 'channel-item';
    item.dataset.index = displayIndex;

    item.innerHTML =
      '<span class="channel-number">' + (displayIndex + 1) + '</span>' +
      '<span class="channel-name"><span class="channel-name-text">' + escapeHtml(channel.name) + '</span></span>';

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
    top.style.height = (virtualStart * stride) + 'px';
    container.prepend(top);
    const bottom = document.createElement('div');
    bottom.style.height = (Math.max(0, total - virtualEnd) * stride) + 'px';
    container.appendChild(bottom);
    const target = virtualStart * stride +
      ((focusedIndex - virtualStart) * stride) - ((container.clientHeight - stride) / 2);
    container.scrollTop = Math.max(0, target);
  }
  container.dataset.virtualStart = virtualStart;
  container.dataset.virtualEnd = virtualEnd;
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
  if (index < 0 || index >= channels.length) return;

  currentIndex = index;
  const displayChannels = getDisplayChannels();
  focusedIndex = displayChannels.indexOf(channels[index]);
  if (focusedIndex < 0) focusedIndex = 0;
  if (focusedIndex < virtualStart || focusedIndex >= virtualEnd) {
    renderChannelList();
  }
  updateActiveChannel();
  updateFocus();

  if (onChannelSelect) {
    onChannelSelect(channels[index]);
  }

  if (!skipFullscreen) {
    requestFullscreen();
  }

  const nameEl = document.getElementById('channel-name');
  const infoEl = document.getElementById('channel-info');

  if (nameEl) {
    nameEl.textContent = channels[index].name;
  }

  if (infoEl) {
    const ext = channels[index].url.split('.').pop().split('?')[0];
    infoEl.textContent = ext.toUpperCase();
  }
}

export function navigateUp() {
  const displayChannels = getDisplayChannels();
  if (displayChannels.length === 0) return;
  focusedIndex = (focusedIndex - 1 + displayChannels.length) % displayChannels.length;
  if (focusedIndex < virtualStart || focusedIndex >= virtualEnd) {
    renderChannelList();
  }
  updateFocus();
  scrollToFocused();
}

export function navigateDown() {
  const displayChannels = getDisplayChannels();
  if (displayChannels.length === 0) return;
  focusedIndex = (focusedIndex + 1) % displayChannels.length;
  if (focusedIndex < virtualStart || focusedIndex >= virtualEnd) {
    renderChannelList();
  }
  updateFocus();
  scrollToFocused();
}

export function selectFocused() {
  const displayChannels = getDisplayChannels();
  const channel = displayChannels[focusedIndex];
  if (channel) {
    selectChannel(channels.indexOf(channel));
  }
}

export function getDisplayChannels() {
  if (selectedGroup === 'all' || !selectedGroup) {
    return channels;
  }
  return channels.filter(ch => (ch.group || 'Ungrouped') === selectedGroup);
}

export function jumpToNumber(num, skipFullscreen) {
  const displayChannels = getDisplayChannels();
  const channel = displayChannels.find(ch => ch.channelNumber === num);
  if (channel) {
    selectChannel(channels.indexOf(channel), skipFullscreen);
  }
}

export function toggleSidebar() {
  if (rightSidebarOpen) {
    rightSidebarOpen = false;
    applyRightSidebar();
  }
  sidebarOpen = !sidebarOpen;
  if (sidebarOpen) {
    if (groups.length > 0 && selectedGroup !== null) {
      sidebarMode = 'channels';
      const displayChannels = getDisplayChannels();
      const playingChannel = channels[currentIndex];
      const idx = playingChannel ? displayChannels.indexOf(playingChannel) : -1;
      focusedIndex = idx >= 0 ? idx : 0;
      const groupList = document.getElementById('group-list');
      const channelList = document.getElementById('channel-list');
      if (groupList) groupList.classList.add('hidden');
      if (channelList) channelList.classList.remove('hidden');
      renderChannelList();
      updateFocus();
    } else if (groups.length > 0) {
      showGroupList();
    } else {
      selectedGroup = null;
      sidebarMode = 'channels';
      focusedIndex = currentIndex >= 0 ? currentIndex : 0;
      renderChannelList();
    }
    updateSidebarTitle();
  }
  applySidebar();
}

export function closeAllOverlays() {
  if (sidebarOpen) {
    sidebarOpen = false;
    applySidebar();
  }
  if (rightSidebarOpen) {
    rightSidebarOpen = false;
    applyRightSidebar();
  }
}

export function isSidebarOpen() {
  return sidebarOpen;
}

export function showSidebarWithContent() {
  sidebarOpen = true;
  applySidebar();
}

export function isFullscreenMode() {
  return isFullscreen;
}

export function requestFullscreen() {
  const app = document.getElementById('app');
  if (app) {
    app.classList.add('fullscreen');
  }
  isFullscreen = true;
  sidebarOpen = false;
  applySidebar();
  rightSidebarOpen = false;
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
  isFullscreen = false;
  sidebarOpen = true;
  rightSidebarOpen = false;
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
  const sidebarHasFocus = sidebarOpen && document.querySelector('#sidebar .focused, #sidebar [data-focused]');
  const rightHasFocus = rightSidebarOpen && document.querySelector('#right-sidebar .focused, #right-sidebar [data-focused]');
  if (sidebarHasFocus || rightHasFocus) {
    resetInactivity();
    return;
  }
  if (autoCloseCallback) {
    autoCloseCallback();
  }
  if (sidebarOpen) {
    sidebarOpen = false;
    applySidebar();
  }
  if (rightSidebarOpen) {
    rightSidebarOpen = false;
    applyRightSidebar();
  }
}

export function resetInactivityTimer() {
  resetInactivity();
}

function applySidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.toggle('closed', !sidebarOpen);
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
  watermark.classList.toggle('docked', !sidebarOpen);
}

function applyBadge() {
  const el = document.getElementById('resolution-badge');
  if (!el) return;
  if (!showBadge) el.classList.add('hidden');
}

export function isBadgeVisible() {
  return showBadge;
}

/* Right sidebar */
export function applyRightSidebar() {
  const el = document.getElementById('right-sidebar');
  if (el) {
    el.classList.toggle('closed', !rightSidebarOpen);
  }
}

export function setAutoCloseCallback(callback) {
  autoCloseCallback = callback;
}

export function toggleRightSidebar() {
  if (sidebarOpen) {
    sidebarOpen = false;
    applySidebar();
  }
  rightSidebarOpen = !rightSidebarOpen;
  applyRightSidebar();
  if (rightSidebarOpen) {
    buildRightItems();
    rightFocus = 0;
    updateRightFocus();
    resetInactivity();
  }
}

export function isRightSidebarOpen() {
  return rightSidebarOpen;
}

export function setResolutionCallback(cb) {
  rightResolutionCallback = cb;
}

export function setResolutions(heights) {
  rightResolutions = ['auto'].concat(heights || []);
  renderRightResolutionList();
  if (rightSidebarOpen) {
    buildRightItems();
    updateRightFocus();
  }
}

export function setSelectedResolution(value) {
  rightSelectedResolution = value;
  renderRightResolutionList();
}

function renderRightResolutionList() {
  const list = document.getElementById('resolution-list-right');
  if (!list) return;
  list.innerHTML = '';
  rightResolutions.forEach((res, index) => {
    const item = document.createElement('div');
    item.className = 'resolution-item-right';
    if (res === rightSelectedResolution) {
      item.classList.add('active');
    }
    item.dataset.index = index;
    item.textContent = res === 'auto' ? 'Auto' : res + 'p';
    item.addEventListener('click', () => {
      rightFocus = index;
      doRightSelect();
    });
    list.appendChild(item);
  });
}

function buildRightItems() {
  rightItems = [];
  // Resolution items (indices 0 .. N-1)
  const list = document.getElementById('resolution-list-right');
  if (list) {
    const resItems = list.querySelectorAll('.resolution-item-right');
    resItems.forEach((item) => {
      rightItems.push({ type: 'resolution', element: item });
    });
  }
  // Button IDs
  const btnIds = ['refresh-stream-btn', 'refresh-channels-btn', 'settings-btn'];
  btnIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      rightItems.push({ type: 'button', element: el, id: id });
    }
  });
}

export function rightSidebarNavigateUp() {
  if (!rightSidebarOpen || rightItems.length === 0) return;
  rightFocus = (rightFocus - 1 + rightItems.length) % rightItems.length;
  updateRightFocus();
}

export function rightSidebarNavigateDown() {
  if (!rightSidebarOpen || rightItems.length === 0) return;
  rightFocus = (rightFocus + 1) % rightItems.length;
  updateRightFocus();
}

export function rightSidebarSelect() {
  if (!rightSidebarOpen || rightItems.length === 0) return;
  const item = rightItems[rightFocus];
  if (!item) return;
  if (item.type === 'resolution') {
    doRightSelect();
  } else if (item.type === 'button') {
    const el = document.getElementById(item.id);
    if (el) el.click();
  }
}

function doRightSelect() {
  const items = document.querySelectorAll('.resolution-item-right');
  const idx = rightFocus;
  if (idx < 0 || idx >= items.length) {
    // Focus is on a button, not a resolution item - do nothing
    return;
  }
  const value = rightResolutions[idx];
  rightSelectedResolution = value;
  renderRightResolutionList();
  if (rightResolutionCallback) {
    rightResolutionCallback(value === 'auto' ? null : value);
  }
  rightSidebarOpen = false;
  applyRightSidebar();
}

function updateRightFocus() {
  rightItems.forEach((item, index) => {
    const focused = index === rightFocus;
    if (item.element) {
      item.element.classList.toggle('focused', focused);
    }
  });
  if (rightItems[rightFocus] && rightItems[rightFocus].element) {
    rightItems[rightFocus].element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

export function getChannels() {
  return channels;
}

export function getCurrentChannel() {
  if (currentIndex >= 0 && currentIndex < channels.length) {
    return channels[currentIndex];
  }
  return null;
}

export function refreshChannelList(newChannels) {
  channels = newChannels;
  currentIndex = -1;
  focusedIndex = 0;
  extractGroups(channels);
  if (selectedGroup === 'all') {
    sidebarMode = 'channels';
  } else if (selectedGroup && !groups.find(g => g.name === selectedGroup)) {
    selectedGroup = null;
    sidebarMode = 'groups';
  } else if (groups.length <= 1) {
    sidebarMode = 'channels';
    selectedGroup = null;
  }
  if (sidebarMode === 'groups') {
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
  if (rightSidebarOpen) {
    rightSidebarOpen = false;
    applyRightSidebar();
  }
}

function updateActiveChannel() {
  const items = document.querySelectorAll('.channel-item');
  const displayChannels = getDisplayChannels();
  const playingDisplayIdx = displayChannels.indexOf(channels[currentIndex]);
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
  marqueeAnimation = textEl.animate([
    { transform: 'translateX(0)' },
    { transform: 'translateX(0)', offset: 0.15 },
    { transform: 'translateX(-' + offset + 'px)', offset: 0.45 },
    { transform: 'translateX(-' + offset + 'px)', offset: 0.55 },
    { transform: 'translateX(0)', offset: 0.85 },
    { transform: 'translateX(0)' },
  ], {
    duration: 4000,
    iterations: Infinity,
  });
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
    const nowFocused = idx === focusedIndex;
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
  const el = document.querySelector('.channel-item[data-index="' + focusedIndex + '"]');
  if (el) {
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/* Channel toast (top) + buffering pill (bottom) with time-aware hints.
   A stuck number makes users zap away — name + hint prove work is ongoing. */
let bufferingChannelName = '';
let bufferingStart = 0;
let bufferingHintTimer = null;
const BUFFERING_HINTS = [
  [4000, ' — slow server, holding on…'],
  [9000, ' — taking longer than usual, you can wait or try another channel'],
];

export function setBufferingChannel(name) {
  bufferingChannelName = name || '';
  const nameEl = document.getElementById('loading-name');
  if (nameEl) nameEl.textContent = bufferingChannelName || 'Loading';
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
  const elapsed = Date.now() - bufferingStart;
  let hint = '';
  for (const [after, text] of BUFFERING_HINTS) {
    if (elapsed >= after) hint = text;
  }
  el.textContent = hint;
}

export function updateBuffering(percent) {
  const el = document.getElementById('buffering-indicator');
  if (el && !el.classList.contains('hidden')) {
    setBufferingPercent(percent);
  }
}

export function hideBuffering() {
  const el = document.getElementById('buffering-indicator');
  if (el) el.classList.add('hidden');
  const veil = document.getElementById('loading');
  if (veil) veil.classList.add('hidden');
  clearInterval(bufferingHintTimer);
  bufferingHintTimer = null;
  const hint = document.getElementById('buffering-hint');
  if (hint) hint.textContent = '';
}

function setBufferingPercent(percent) {
  const p = document.getElementById('buffering-percent');
  if (p) p.textContent = (typeof percent === 'number' ? percent : 0) + '%';
}

/* Update badge on the Settings menu button (gentle, non-blocking) */
export function setUpdateBadge(visible) {
  const btn = document.getElementById('settings-btn');
  if (btn) btn.classList.toggle('has-update', !!visible);
}

/* Confirm Dialog */
let dialogOpen = false;
let dialogConfirmCallback = null;
let dialogCancelCallback = null;
let dialogFocus = 0;

export function isDialogOpen() {
  return dialogOpen;
}

export function showConfirmDialog(message, onConfirm, onCancel) {
  dialogOpen = true;
  dialogConfirmCallback = onConfirm;
  dialogCancelCallback = onCancel;
  dialogFocus = 1;
  const el = document.getElementById('confirm-dialog');
  const msgEl = document.getElementById('confirm-dialog-message');
  if (msgEl) msgEl.textContent = message;
  if (el) el.classList.remove('hidden');
  updateDialogFocus();
}

export function hideConfirmDialog() {
  dialogOpen = false;
  dialogConfirmCallback = null;
  dialogCancelCallback = null;
  const el = document.getElementById('confirm-dialog');
  if (el) el.classList.add('hidden');
}

export function dialogNavigate(dir) {
  if (!dialogOpen) return;
  dialogFocus = (dialogFocus + dir + 2) % 2;
  updateDialogFocus();
}

export function dialogSelect() {
  if (!dialogOpen) return;
  const isConfirm = dialogFocus === 1;
  const cb = isConfirm ? dialogConfirmCallback : dialogCancelCallback;
  hideConfirmDialog();
  if (cb) cb(isConfirm);
}

function updateDialogFocus() {
  const cancelBtn = document.getElementById('confirm-dialog-cancel');
  const confirmBtn = document.getElementById('confirm-dialog-confirm');
  if (cancelBtn) cancelBtn.classList.toggle('focused', dialogFocus === 0);
  if (confirmBtn) confirmBtn.classList.toggle('focused', dialogFocus === 1);
}
