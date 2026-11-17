// Shared settings state (T-140, Risk C). One object so every settings slice
// sees the same focus section, form mode and playlist edit index. Not reactive
// — T-170 is a separate ticket.
export const state = {
  container: null,
  onPlaylistFetched: null,
  onRender: null,
  editIndex: -1,
  activeSection: 'source',
  focusIdx: 0,
  focusOrder: [],
  addMode: false,
  editMode: false,
  addType: 'm3u',
  editType: 'm3u',
};
