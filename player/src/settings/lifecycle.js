// Settings lifecycle (T-142). Moved verbatim from settings.js. The container
// is set by init(); show/openAddForm guard on it so first-run onboarding can
// call them before init without throwing (see T-211).
import { state } from './state.js';
import { deps } from './deps.js';
import { render } from './render.js';

export function init(settingsContainer, callbacks) {
  state.container = settingsContainer;
  state.onPlaylistFetched = callbacks.onPlaylistFetched;
  state.onRender = callbacks.onRender;
}

export function show() {
  if (!state.container) return;
  state.editIndex = -1;
  state.addMode = false;
  state.editMode = false;
  state.activeSection = 'source';
  state.focusIdx = 0;
  state.container.classList.remove('hidden');
  render();
  deps.applyFocus();
}

// Opens Settings → Source with the add form showing, preset to the given
// type ('m3u' or 'xtream'). Used by the first-run source picker.
export function openAddForm(type) {
  if (!state.container) return;
  state.activeSection = 'source';
  state.addMode = true;
  state.editMode = false;
  state.editIndex = -1;
  state.addType = type === 'xtream' ? 'xtream' : 'm3u';
  state.focusIdx = 0;
  state.container.classList.remove('hidden');
  render();
  deps.applyFocus();
}

export function hide() {
  if (!state.container) return;
  state.container.classList.add('hidden');
}

export function isVisible() {
  return state.container && !state.container.classList.contains('hidden');
}

// Wire the render/playlist callbacks the nav and select slices call through
// deps. This module is imported by index.js, so the wiring runs before any
// remote action can reach those slices.
import { saveAddPlaylist, saveEditPlaylist, setFormType, testXtreamLogin, handleFetch } from './playlists.js';
import { groupNames } from './render-cards.js';
import { saveAddMedia } from './media.js';

Object.assign(deps, {
  render,
  saveAddPlaylist,
  saveEditPlaylist,
  setFormType,
  testXtreamLogin,
  handleFetch,
  groupNames,
  importMediaSource: saveAddMedia,
});
