// Shared module state for the UI layer (T-130, docs/MIGRATION.md Risk C).
//
// `ui.js` is about to be sliced into `ui/core.js`, `ui/sidebar.js`,
// `ui/search.js`, `ui/right-menu.js`, `ui/osd.js` and `ui/dialogs.js`. Every one
// of those slices reads and writes the variables below. If each slice kept its
// own copy, the UI would still compile and still start — and would silently
// stop tracking the focused channel, the open sidebar or the current search.
//
// So the state lives here, in one object, and every slice imports this exact
// reference. Only variables shared by more than one upcoming slice belong
// here; callbacks and constants that stay inside a single slice remain local
// to that slice.
//
// Deliberately NOT a reactive store. That is T-170 in a later phase, kept
// separate so a future failure has one cause. Property mutation (never
// destructuring a snapshot) is what keeps this a behaviour-identical move.

export const state = {
  // ── Channel list and virtualisation ───────────────────────────────────
  channels: [],
  currentIndex: -1,
  focusedIndex: 0,
  virtualStart: 0,
  virtualEnd: 0,

  // ── Fullscreen and sidebars ───────────────────────────────────────────
  sidebarOpen: false,
  isFullscreen: false,
  rightSidebarOpen: false,
  rightResolutions: [],
  rightFocus: 0,
  rightItems: [],

  // ── Group sidebar ─────────────────────────────────────────────────────
  sidebarMode: 'channels',
  groups: [],
  selectedGroup: null,
  groupFocusedIndex: 0,

  // ── Cross-group search ────────────────────────────────────────────────
  searchQuery: '',
  searchResults: [],
  searchFocus: 0,
};
