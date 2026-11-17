// The three feature stores (T-170). Shapes are copied verbatim from the old
// ui/state.js and app/state.js so every consumer keeps the exact object it
// captured at import time; only the owner of the initial shape changes here.

import { createStore } from './createStore.js';

export { createStore } from './createStore.js';

export const uiState = createStore({
  // Channel list and virtualisation
  channels: [],
  currentIndex: -1,
  focusedIndex: 0,
  virtualStart: 0,
  virtualEnd: 0,

  // Fullscreen and sidebars
  sidebarOpen: false,
  isFullscreen: false,
  rightSidebarOpen: false,
  rightResolutions: [],
  rightFocus: 0,
  rightItems: [],

  // Group sidebar
  sidebarMode: 'channels',
  groups: [],
  selectedGroup: null,
  groupFocusedIndex: 0,

  // Cross-group search
  searchQuery: '',
  searchResults: [],
  searchFocus: 0,
});

export const appState = createStore({
  // Boot timers
  bootTypewriterTimer: null,
  bootShownAt: 0,
  bootTypewriterEnd: 0,

  // Shared app variables
  currentIndex: 0,
  channels: undefined,
  selectedGroup: null,
  bufferingInterval: null,
  bufferingActive: false,
  cleanupListeners: [],
  playbackStarted: false,
  tuneSucceeded: false,
  lastIntent: null,
  tuneSeq: 0,
  pendingUpdate: null,
  onboardFocus: 0,
  progressActive: false,
  lastBackTime: 0,
});

// VOD feature state (T-180 onwards): the library and its cross-item search.
export const vodState = createStore({ library: [], search: '' });
