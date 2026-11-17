// Channel list + refresh (T-152c). Fetches, persists and re-tunes the
// playlist without pulling in the remote or boot slices; every caller
// reaches these through deps.
import { getSettings, saveSettings, getActivePlaylist, getHiddenGroups } from '../config.js';
import { fetchPlaylistEntry, fetchPlaylistWithRetry } from '../utils.js';
import { filterDisplayChannels, findIntentIndex } from '../logic.js';
import * as player from '../player/index.js';
import * as ui from '../ui/index.js';
import { state } from './state.js';
import { deps } from './deps.js';

function getDisplayChannels() {
  return filterDisplayChannels(state.channels, getHiddenGroups(), state.selectedGroup);
}
async function refreshChannelsInBackground() {
  const active = getActivePlaylist();
  if (!active || !active.url) return true;
  try {
    const newChannels = await fetchPlaylistWithRetry(active);
    applyFreshChannels(newChannels);
    // The boot tune ran on pre-refresh (possibly stale-token) URLs. If it
    // never got anywhere, re-tune the same channel with its fresh URL
    // instead of stranding the user on the brand screen. Working playback
    // is never touched.
    if (!state.playbackStarted && !state.tuneSucceeded && state.lastIntent) {
      const at = findIntentIndex(state.channels, state.lastIntent);
      if (at >= 0) ui.selectChannel(at, true);
    }
    return true;
  } catch (e) {
    console.warn('Background playlist refresh failed:', e.message);
    return false;
  }
}

// Swap in a freshly fetched channel list (persist + sort + repaint).
function applyFreshChannels(newChannels) {
  saveSettings({ channels: newChannels, channelsFetched: new Date().toISOString() });
  sortChannels(newChannels);
  state.channels = newChannels;
  ui.refreshChannelList(state.channels);
}

// Expired-token recovery: the player retried the frozen channel URL and the
// server still says 403/401, so mint a fresh link via the playlist instead.
// Re-tunes by name+group (URLs rotate); falls back to one last same-URL
// load (no budget reset) so the normal advance path ends it if the link is
// truly dead. Never yanks the user back if they already moved on.
async function handleStaleToken(deadChannel) {
  try {
    if (!deadChannel || !state.lastIntent) return;
    const deadGroup = deadChannel.group || 'Ungrouped';
    if (deadChannel.name !== state.lastIntent.name || deadGroup !== state.lastIntent.group) return;
    let fresh = null;
    try {
      const active = getActivePlaylist();
      if (active && active.url) fresh = await fetchPlaylistWithRetry(active);
    } catch (e) {
      console.warn('Stale-token playlist refetch failed:', e.message);
    }
    if (fresh) {
      applyFreshChannels(fresh);
      const at = findIntentIndex(state.channels, state.lastIntent);
      if (at >= 0 && state.channels[at].url !== deadChannel.url) {
        ui.selectChannel(at, true);
        return;
      }
    }
    player.loadChannel(deadChannel);
  } catch (e) {
    console.warn('Stale-token recovery failed:', e.message);
  }
}

// Background refresh failed after retries: the cached list is still on
// screen — say so (with its date) instead of failing silently.
function showStaleCacheNotice() {
  let when = '';
  try {
    const iso = getSettings().channelsFetched;
    if (iso) when = ' from ' + new Date(iso).toLocaleDateString();
  } catch {}
  ui.showTransientNotice('Playlist update failed — using saved list' + when);
}
function sortChannels(ch) {
  if (!ch || !ch.length) return;
  // Provider order (default): keep playlist file order. A–Z is opt-in.
  if (getSettings().channelSort !== 'name') return;
  ch.sort((a, b) => {
    if (!a || !b) return 0;
    // Sort by group first, then alphabetically by name within group
    const aGroup = (a.group || 'Ungrouped').toLowerCase();
    const bGroup = (b.group || 'Ungrouped').toLowerCase();
    if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
    return (a.name || '').localeCompare(b.name || '');
  });
}

export async function refreshChannels() {
  const active = getActivePlaylist();
  if (active && active.url) {
    try {
      const newChannels = await fetchPlaylistEntry(active);
      saveSettings({ channels: newChannels, channelsFetched: new Date().toISOString() });
      sortChannels(newChannels);
      state.channels = newChannels;
      ui.refreshChannelList(state.channels);
    } catch (e) {
      console.warn('Failed to refresh from playlist:', e.message);
    }
  }
}

// Self-register so the hub and sibling slices reach these through slots.
Object.assign(deps, {
  getDisplayChannels,
  handleStaleToken,
  refreshChannelsInBackground,
  showStaleCacheNotice,
  sortChannels,
  refreshChannels,
});
