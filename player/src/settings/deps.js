// Cross-slice callbacks for settings slices (T-140). Pure module. An unwired
// slot throws loudly so a missed registration cannot silently break remote
// navigation — exactly the BUG-011/012 class this slice must preserve.
function unwired(name) {
  return () => {
    throw new Error(`settings deps: ${name} was called before it was wired`);
  };
}

export const deps = {
  render: unwired('render'),
  saveAddPlaylist: unwired('saveAddPlaylist'),
  saveEditPlaylist: unwired('saveEditPlaylist'),
  setFormType: unwired('setFormType'),
  testXtreamLogin: unwired('testXtreamLogin'),
  handleFetch: unwired('handleFetch'),
  groupNames: unwired('groupNames'),
  moveSettingsFocus: unwired('moveSettingsFocus'),
  applyFocus: unwired('applyFocus'),
  buildFocusOrder: unwired('buildFocusOrder'),
  clearFocus: unwired('clearFocus'),
  copyDiagnostics: unwired('copyDiagnostics'),
  importMediaSource: unwired('importMediaSource'),
};
