// Settings public API (T-142). Pure re-export hub: the 8 names that
// main.js and the rest of the app imported from settings.js are unchanged.
// Slices wire their own deps slots at module load, so this hub only assembles
// the surface. Internal slices (dom, nav, select, render, playlists, groups,
// playback) are reached through those slices' imports.
export * from './nav.js';
export * from './select.js';
export * from './lifecycle.js';
