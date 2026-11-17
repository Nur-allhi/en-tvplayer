// Pure info-bar content builder (T-202). Given a channel and display metadata,
// it produces the fields the OSD shows after a channel switch. No DOM, no
// timers, no clock read — the caller supplies the formatted clock string so
// the whole module is deterministic and testable in node env.

export function streamTypeFor(url) {
  if (typeof url !== 'string' || !url) return '';
  const clean = url.split('#')[0].split('?')[0];
  const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase();
  if (!ext || ext.length > 6 || ext === clean) return '';
  return ext.toUpperCase();
}

/**
 * Build the info-bar view model.
 * @param {Object} channel - { name, group, url, channelNumber }
 * @param {Object} [meta] - { resolution, clock } display overrides
 * @returns {{ name:string, group:string, resolution:string, streamType:string,
 *             channelNumber:string, clock:string }}
 */
export function buildInfoBar(channel, meta = {}) {
  const ch = channel || {};
  const name = typeof ch.name === 'string' ? ch.name : '';
  const group = typeof ch.group === 'string' ? ch.group : '';
  const channelNumber = ch.channelNumber != null ? String(ch.channelNumber) : '';
  const streamType = meta.streamType || streamTypeFor(ch.url);
  const resolution = typeof meta.resolution === 'string' ? meta.resolution : '';
  const clock = typeof meta.clock === 'string' ? meta.clock : '';
  return { name, group, resolution, streamType, channelNumber, clock };
}

/** Format the info-bar text. Kept separate so traits are testable without CSS. */
export function formatInfoBar(channel, meta = {}) {
  const info = buildInfoBar(channel, meta);
  const parts = [];
  if (info.channelNumber) parts.push(info.channelNumber);
  if (info.name) parts.push(info.name);
  if (info.group) parts.push('[' + info.group + ']');
  if (info.resolution) parts.push(info.resolution);
  if (info.streamType) parts.push(info.streamType);
  if (info.clock) parts.push(info.clock);
  return parts.join('  •  ');
}
