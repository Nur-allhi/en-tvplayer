// Right sidebar: quality / audio dropdowns, proxy and action buttons (T-134).
// ui.js re-exports the public names so callers keep using ui.*. The two calls
// back into the core (applySidebar, resetInactivity) go through deps.js, which
// ui.js wires at boot — the slice never imports the re-export hub, so no import
// cycle is created.

import { state } from './state.js';
import { deps } from './deps.js';
let rightSelectedResolution = 'auto';
let rightResolutionCallback = null;
export function applyRightSidebar() {
  const el = document.getElementById('right-sidebar');
  if (el) {
    el.classList.toggle('closed', !state.rightSidebarOpen);
  }
}
export function toggleRightSidebar() {
  if (state.sidebarOpen) {
    state.sidebarOpen = false;
    deps.applySidebar();
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
    deps.resetInactivity();
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
function refreshRightFocus() {
  if (state.rightSidebarOpen) {
    buildRightItems();
    clampRightFocus();
    updateRightFocus();
  }
}
export function setResolutions(heights) {
  state.rightResolutions = ['auto'].concat(heights || []);
  renderRightResolutionList();
  refreshRightFocus();
}
export function setSelectedResolution(value) {
  rightSelectedResolution = value;
  renderRightResolutionList();
  refreshRightFocus();
}
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
  refreshRightFocus();
}
export function setSelectedAudio(id) {
  rightSelectedAudioId = id;
  renderAudioList();
  refreshRightFocus();
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
  deps.resetInactivity();
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
  deps.resetInactivity();
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
  const btnIds = ['refresh-stream-btn', 'refresh-channels-btn', 'settings-btn', 'subtitle-btn', 'proxy-toggle-btn'];
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
