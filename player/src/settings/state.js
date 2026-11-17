// Shared settings state (T-140, Risk C). One object so every settings slice
// sees the same focus section, form mode and playlist edit index. Not reactive
// — T-170 is a separate ticket.
export const NAV_ITEMS = [
  { id: 'source', icon: '📡', label: 'Channel Source' },
  { id: 'playback', icon: '▶', label: 'Playback' },
  { id: 'about', icon: 'ℹ', label: 'About' },
];

// Max saved playlists (was 8 — capped at 3 to keep the source card compact).
export const MAX_PLAYLISTS = 3;

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
