// UI public API (T-135). Pure re-export hub: the 74 names old ui.js exposed
// are unchanged, so callers keep using ui.*. Each slice wires its own deps
// slots locally; this hub only assembles the surface.
export * from './core.js';
export * from './channel-view.js';
export * from './chrome.js';
export * from './sidebar.js';
export * from './search.js';
export * from './right-menu.js';
export * from './dialogs.js';
export * from './osd.js';
export * from './library.js';
