// Pure, DOM-free logic for unit testing (Vitest, node env).
// Everything here must stay side-effect free: no localStorage, no
// document, no timers — inputs in, values out. Callers in main.js,
// ui.js and player.js own the module state and the DOM.

export function filterDisplayChannels(allChannels, hiddenGroups, selectedGroup) {
  const hidden = hiddenGroups || [];
  const visible = (allChannels || []).filter((ch) => !hidden.includes((ch && ch.group) || 'Ungrouped'));
  if (selectedGroup === 'all' || !selectedGroup) return visible;
  return visible.filter((ch) => ((ch && ch.group) || 'Ungrouped') === selectedGroup);
}

// Boot resume: identity is the channel URL (stable across playlist
// refresh and re-sort); a raw index would rot on every fetch. Returns
// the index, or -1 when nothing was saved, the channel is gone, or its
// group is now hidden.
export function findResumeIndex(channels, lastChannelUrl, hiddenGroups) {
  if (!lastChannelUrl) return -1;
  const at = (channels || []).findIndex((ch) => ch && ch.url === lastChannelUrl);
  if (at < 0) return -1;
  const group = ((channels[at] && channels[at].group) || 'Ungrouped');
  if ((hiddenGroups || []).includes(group)) return -1;
  return at;
}

// Background-refresh re-tune: names + groups survive token rotation,
// URLs don't. Returns the index of the same channel, or -1.
export function findIntentIndex(channels, intent) {
  if (!intent) return -1;
  return (channels || []).findIndex((ch) => ch && ch.name === intent.name &&
    (((ch && ch.group) || 'Ungrouped') === intent.group));
}

// Live-segment-404 reload budget: 3 edge re-syncs per URL inside a
// 5-minute window, then the link is condemned. Pure version of the
// player.js segment404* state machine — pass the stored state in, get
// the decision plus the next state back.
export function segment404Decision(prevState, url, now = Date.now()) {
  let attempts = 0;
  if (prevState && prevState.url === url && now - prevState.lastAt <= 5 * 60 * 1000) {
    attempts = prevState.attempts;
  }
  if (attempts >= 3) {
    return { retry: false, state: { url, attempts, lastAt: now } };
  }
  return { retry: true, state: { url, attempts: attempts + 1, lastAt: now } };
}

// 401/403 mid-playback budget: `attempts` is the count AFTER
// incrementing. Three fresh-token retries, then advance channels.
export function lastResortDecision(attempts) {
  return attempts <= 3 ? 'retry' : 'advance';
}
