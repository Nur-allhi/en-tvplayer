// Pure text-track helpers (T-184). Shaka tracks are normalised into a simple
// list the remote-friendly picker can cycle through; no DOM, no player state.

export function normalizeTextTracks(tracks) {
  return (tracks || [])
    .filter((track) => track && track.id != null)
    .map((track, index) => {
      let label = track.label;
      if (!label && track.language && track.language !== 'und') label = track.language;
      if (!label) label = 'Subtitles ' + (index + 1);
      return { id: track.id, label, active: !!track.active };
    });
}

export function textTrackOptions(tracks) {
  return [{ id: null, label: 'Off' }, ...normalizeTextTracks(tracks)];
}

// Returns the index of the next option in the cycle, wrapping to Off.
export function nextTextOption(options, currentId) {
  const at = options.findIndex((option) => option.id === currentId);
  return (at + 1) % options.length;
}
