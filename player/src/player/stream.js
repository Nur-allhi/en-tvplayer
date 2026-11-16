// Stream/track queries and selection (T-122).
//
// Pure reads over the shared player state — the DRM path (isEmeSupported)
// and the track pickers live here so player.js can re-export them unchanged.
import { state } from './state.js';

export function getActiveTrack() {
  if (!state.player) return null;
  const tracks = state.player.getVariantTracks();
  return tracks.find((t) => t.active) || null;
}

export function getActiveHeight() {
  const t = getActiveTrack();
  return t ? t.height : null;
}

export function getActiveBandwidth() {
  const t = getActiveTrack();
  return t ? t.bandwidth : null;
}

export function isEmeSupported() {
  const hasApi = typeof navigator !== 'undefined' && typeof navigator.requestMediaKeySystemAccess === 'function';
  const hasMediaKeys = typeof window !== 'undefined' && 'MediaKeys' in window;
  const ok = hasApi && hasMediaKeys;

  return ok;
}

export function setAutoQuality(enabled) {
  if (state.useAvplay) return;
  if (!state.player) return;
  state.player.configure({ abr: { enabled } });
}

export function getPlayer() {
  return state.player;
}

export function getBufferingPercent() {
  if (state.useAvplay) return state.avplayBufferPercent;
  if (!state.videoElement) return 0;
  const buffered = state.videoElement.buffered;
  let end = 0;
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= state.videoElement.currentTime && state.videoElement.currentTime <= buffered.end(i)) {
      end = buffered.end(i);
    }
  }
  const ahead = Math.max(0, end - state.videoElement.currentTime);
  return Math.min(100, Math.round((ahead / 20) * 100));
}

export function getResolutions() {
  if (state.useAvplay || !state.player) return [];
  const tracks = state.player.getVariantTracks();
  const heights = [...new Set(tracks.map((t) => t.height))].filter(Boolean).sort((a, b) => a - b);
  return heights;
}

export function selectResolution(height) {
  if (state.useAvplay || !state.player) return;

  if (height == null) {
    state.player.configure({ abr: { enabled: true } });
    return;
  }

  const tracks = state.player.getVariantTracks().filter((t) => t.height === height);
  if (tracks.length) {
    state.player.configure({ abr: { enabled: false } });
    state.player.selectVariantTrack(tracks[0], true);
  }
}

// Multi-audio channels (languages, commentary, …): Shaka exposes the
// audio adaptations compatible with the current video track. Selecting one
// keeps video ABR running — only the audio switches.
export function getAudioTracks() {
  if (state.useAvplay || !state.player) return [];
  try {
    return state.player.getAudioTracks().map((t) => ({
      id: t.id,
      language: t.language || '',
      label: t.label || '',
      active: !!t.active,
    }));
  } catch {
    return [];
  }
}

export function getActiveAudioId() {
  const active = getAudioTracks().find((t) => t.active);
  return active ? active.id : null;
}

export function selectAudioTrackById(id) {
  if (state.useAvplay || !state.player || id == null) return;
  try {
    const track = state.player.getAudioTracks().find((t) => t.id === id);
    if (track) state.player.selectAudioTrack(track);
  } catch (e) {
    console.warn('Audio select failed:', e);
  }
}

export function getVideoElement() {
  return state.videoElement;
}
