// Tune + progress UI (T-152c). The paint-gated channel tune and the
// single-narrative progress toast, together with the resolution badge
// helpers they share. All DOM work stays in this slice.
import { getSettings, saveSettings } from '../config.js';
import { tuneSuperseded } from '../logic.js';
import * as player from '../player/index.js';
import * as ui from '../ui/index.js';
import { state } from './state.js';
import { deps } from './deps.js';

function forcePaint() {
  try {
    void document.body.offsetHeight;
  } catch {}
}

async function handleChannelSelect(channel) {
  // Record the tune intent FIRST (before the paint-delay await below): the
  // background refresh may land while this tune is still yielding, and it
  // needs the latest intent to decide on a fresh-URL re-tune.
  const mySeq = ++state.tuneSeq;
  state.currentIndex = state.channels.indexOf(channel);
  // Latest tune intent (name+group survive token rotation; URLs don't).
  state.lastIntent = { name: channel.name, group: channel.group || 'Ungrouped' };
  // Hard visual reset FIRST: one clean narrative (name + Connecting…),
  // every stale pill/error/progress from the previous tune hidden at once.
  ui.resetTuneStatus(channel && channel.name);
  hideProgress();
  ui.setAudioTracks([]);
  ui.setSubtitleTracks([]);
  // Force the veil + name through layout before the teardown/load below
  // runs — on Tizen the first paint can otherwise stall until load
  // resolves, leaving a bare logo with no indication of what's happening.
  forcePaint();
  // Drop the video plane at once: on Tizen it renders above the web layer,
  // so without this the old/black frame covers the loading veil.
  const tuneVideo = document.getElementById('video');
  if (tuneVideo) tuneVideo.style.visibility = 'hidden';
  // Let the veil paint before the teardown/load below blocks the main thread.
  // On TV the first paint can otherwise only happen after load resolves,
  // so users see black instead of the spinner + name.
  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    try {
      requestAnimationFrame(() => setTimeout(finish, 30));
    } catch {
      finish();
    }
    setTimeout(finish, 350); // safety: never stall tuning
  });
  // Fast-zap burst: a newer press arrived while the veil was painting — the
  // player belongs to it now, so bail before touching anything. The UI above
  // already shows the latest channel; only the load is skipped.
  if (tuneSuperseded(mySeq, state.tuneSeq)) return;
  // Stamp the active playlist so Channel Source cards can show "last played".
  try {
    const s = getSettings();
    const idx = s.activePlaylistIndex;
    if (s.playlists[idx]) {
      s.playlists[idx].lastPlayedAt = new Date().toISOString();
      saveSettings({ playlists: s.playlists });
    }
  } catch {}
  // Resume: remember what was playing (URL is stable across refresh/sort).
  try {
    state.selectedGroup = ui.getSelectedGroup();
    saveSettings({ lastChannelUrl: channel.url, lastGroup: state.selectedGroup });
  } catch {}
  ui.setProxyToggleLabel(!!(getSettings().proxyChannels || {})[channel.url]);
  const ok = await player.loadChannel(channel);
  state.tuneSucceeded = ok === true;
  if (!ok) {
    hideProgress();
    ui.hideBuffering();
    ui.showEmptyLogo('');
  } else if (!state.bufferingActive) {
    // Fast channel: loaded with nothing left to buffer — drop the name toast.
    ui.hideBuffering();
  } else {
    // Still buffering after load: veil is gone, first frame not up yet.
    // Keep the center brand with the channel name under it until playback.
    ui.showEmptyLogo(channel.name);
  }
  ui.setSelectedResolution('auto');
  const p = player.getPlayer();
  if (p) {
    ui.setResolutions(player.getResolutions());
    ui.setAudioTracks(player.getAudioTracks());
    ui.setSubtitleTracks(player.getTextTracks());
    const height = player.getActiveHeight();
    if (height) updateResolutionBadge(height);
  }
}

const labelMap = [
  [480, 'SD'],
  [720, 'HD'],
  [1080, 'FHD'],
  [1440, '2K'],
  [2160, '4K'],
];

function getResolutionLabel(height) {
  if (!height) return 'Auto';
  for (const [max, label] of labelMap) {
    if (height <= max) return label;
  }
  return '8K';
}

function formatBandwidth(bps) {
  if (!bps || bps <= 0) return '';
  const mbps = (bps / 1000000).toFixed(1);
  return ' \u2022 ' + mbps + ' Mbps';
}

function channelTypeTag(channel) {
  if (!channel || !channel.url) return '';
  const ext = channel.url.split('?')[0].split('.').pop().trim().toUpperCase();
  if (!ext || ext.length > 5 || ext.includes('/')) return '';
  return ' \u2022 ' + ext;
}

function updateResolutionBadge(height, bandwidth) {
  const el = document.getElementById('resolution-badge');
  if (!el) return;
  if (getSettings().showResolutionBadge === false) {
    el.classList.add('hidden');
    return;
  }
  const label = getResolutionLabel(height);
  const bw = bandwidth || player.getActiveBandwidth();
  const type = channelTypeTag(state.channels[state.currentIndex]);
  el.textContent = label + formatBandwidth(bw) + type;
  el.classList.remove('hidden');
}

function showProgress(text) {
  const el = document.getElementById('progress-toast');
  if (!el) return;
  state.progressActive = true;
  el.classList.remove('hidden');
  document.getElementById('progress-text').textContent = text;
}

function updateProgressPercent(percent) {
  if (!state.progressActive) return;
  const el = document.getElementById('progress-text');
  if (el && typeof percent === 'number') {
    el.textContent = 'Reloading ' + percent + '%';
  }
}

function hideProgress() {
  state.progressActive = false;
  const el = document.getElementById('progress-toast');
  if (el) el.classList.add('hidden');
}

// Self-register so the hub and sibling slices reach these through slots.
Object.assign(deps, {
  handleChannelSelect,
  updateResolutionBadge,
  showProgress,
  hideProgress,
  updateProgressPercent,
  forcePaint,
});
