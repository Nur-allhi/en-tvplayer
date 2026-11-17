// VOD resume capture/restore (T-185). DOM-coupled, so the decisions it makes
// live in lib/resume.js and are unit-tested there. One active reference at a
// time: a new VOD play captures the previous position before switching.

import { setResumeAt } from '../state/vod.js';
import { flushVod } from './vod-store.js';
import { resumeDecision } from '../lib/resume.js';

let reference = null;

const video = () => document.getElementById('video');

export function rememberVod(entry, episode) {
  captureVod();
  reference = { id: entry.id, episodeId: episode ? episode.id : null };
}

export function captureVod() {
  if (!reference) return;
  const el = video();
  if (el && Number.isFinite(el.currentTime) && el.currentTime > 0) {
    setResumeAt(reference.id, reference.episodeId, el.currentTime);
    flushVod();
  }
  reference = null;
}

export function restoreVod(at) {
  const el = video();
  const decision = resumeDecision(at, el && el.duration);
  if (!decision.at || !el) return;
  const seek = () => {
    if (Number.isFinite(el.duration) && el.duration > 0) {
      el.currentTime = Math.min(decision.at, el.duration - 0.1);
    }
    el.removeEventListener('loadedmetadata', seek);
  };
  el.addEventListener('loadedmetadata', seek);
}
