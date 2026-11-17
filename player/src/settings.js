// T-140: navigation and OK/Enter handling moved to their own slices.
import { state } from './settings/state.js';
import { deps } from './settings/deps.js';
export { navigate, navigateNav } from './settings/nav.js';
export { selectFocused } from './settings/select.js';
// T-141: rendering and playlist CRUD moved into their own slices.
import { render } from './settings/render.js';
import { saveAddPlaylist, saveEditPlaylist, setFormType, testXtreamLogin, handleFetch } from './settings/playlists.js';
import { groupNames } from './settings/render-cards.js';
// Wire the callbacks the nav/select slices call through deps.
Object.assign(deps, {
  render,
  saveAddPlaylist,
  saveEditPlaylist,
  setFormType,
  testXtreamLogin,
  handleFetch,
  groupNames,
});

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
