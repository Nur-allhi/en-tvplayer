// Cross-slice callbacks for the UI slices (T-133). Pure module: no imports,
// no DOM at import time. ui.js wires the concrete implementations at boot, so
// a slice never imports the re-export hub back (that would be an import cycle).
// An unwired slot throws loudly rather than silently doing nothing.

function unwired(name) {
  return () => {
    throw new Error(`ui deps: ${name} was called before ui.js wired it`);
  };
}

export const deps = {
  renderChannelList: unwired('renderChannelList'),
  updateFocus: unwired('updateFocus'),
  selectChannel: unwired('selectChannel'),
  renderGroupList: unwired('renderGroupList'),
  updateSidebarTitle: unwired('updateSidebarTitle'),
  applySidebar: unwired('applySidebar'),
  resetInactivity: unwired('resetInactivity'),
  computeSearchResults: unwired('computeSearchResults'),
  renderSearchResults: unwired('renderSearchResults'),
  updateActiveChannel: unwired('updateActiveChannel'),
  scrollToFocused: unwired('scrollToFocused'),
  applyWatermark: unwired('applyWatermark'),
};
