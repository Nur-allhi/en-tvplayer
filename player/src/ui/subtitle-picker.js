// Subtitle picker (T-184). Remote-friendly cycle button in the right sidebar.
// A new slice because right-menu.js is already 297/300 LOC. Tracks come from
// the loaded stream; selection is applied through an injected callback.

import { textTrackOptions, nextTextOption } from '../lib/tracks.js';

let options = [{ id: null, label: 'Off' }];
let currentId = null;
let callback = null;
let wired = false;

export function setSubtitleCallback(fn) {
  callback = typeof fn === 'function' ? fn : null;
}

export function setSubtitleTracks(tracks, activeId = null) {
  const active = tracks?.find((track) => track.active);
  currentId = activeId ?? (active ? active.id : null);
  options = textTrackOptions(tracks);
  if (!options.some((option) => option.id === currentId)) currentId = null;
  renderSubtitleButton();
}

function renderSubtitleButton() {
  const button = document.getElementById('subtitle-btn');
  if (!button) return;
  const option = options.find((item) => item.id === currentId) || options[0];
  button.textContent = 'Subtitles: ' + (option ? option.label : 'Off');
  button.classList.toggle('hidden', options.length <= 1);
}

export function cycleSubtitle() {
  const index = nextTextOption(options, currentId);
  const option = options[index];
  if (!option) return;
  currentId = option.id;
  if (callback) callback(currentId);
  renderSubtitleButton();
}

// Called once from the shell, alongside the other right-sidebar buttons.
export function initSubtitlePicker() {
  if (wired) return;
  const button = document.getElementById('subtitle-btn');
  if (!button) return;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    cycleSubtitle();
  });
  wired = true;
  renderSubtitleButton();
}
