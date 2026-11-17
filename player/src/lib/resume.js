// Pure resume helpers (T-183). DOM-free, no storage. The player-side restore
// arrives with T-185; these functions define the ±5s contract it must honour.

export function clampPosition(pos, duration) {
  if (!Number.isFinite(pos) || pos < 0) return 0;
  if (Number.isFinite(duration) && duration > 0) return Math.min(pos, duration);
  return pos;
}

const pad = (value) => String(value).padStart(2, '0');

export function formatTime(seconds) {
  const total = Math.floor(clampPosition(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

// Ignore the first and last five seconds: resuming there is indistinguishable
// from starting over or from having finished the video.
export function isResumable(resumeAt, duration) {
  if (!Number.isFinite(resumeAt) || resumeAt <= 5) return false;
  if (Number.isFinite(duration) && duration > 0 && resumeAt >= duration - 5) return false;
  return true;
}

export function resumeDecision(resumeAt, duration) {
  const at = isResumable(resumeAt, duration) ? clampPosition(resumeAt, duration) : 0;
  return { label: at ? `Resume at ${formatTime(at)}` : 'Play from start', at };
}

export function withinTolerance(a, b, tolerance = 5) {
  return Math.abs(a - b) <= tolerance;
}

export function groupEpisodesBySeason(episodes) {
  const bySeason = new Map();
  for (const episode of episodes || []) {
    const season = episode.season || 0;
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season).push(episode);
  }
  return [...bySeason.entries()]
    .sort(([a], [b]) => a - b)
    .map(([season, list]) => [season, list.slice().sort((a, b) => (a.number || 0) - (b.number || 0))]);
}
