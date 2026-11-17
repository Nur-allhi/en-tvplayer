// Pure VOD → player adapter (T-185). The existing loadChannel() already takes
// a channel-shaped object; this builds one from a media entry (and optional
// episode) so VOD playback reuses Shaka and the AVPlay fallback unchanged.

export function mediaToChannel(entry, episode = null) {
  const channel = {
    name: episode && episode.title ? `${entry.title || entry.id} — ${episode.title}` : entry.title || entry.id,
    url: episode && episode.url ? episode.url : entry.url,
  };
  if (entry.drm) channel.drm = entry.drm;
  if (entry.customHeaders) channel.customHeaders = entry.customHeaders;
  if (entry.userAgent) channel.userAgent = entry.userAgent;
  if (entry.authQuery) channel.authQuery = entry.authQuery;
  return channel;
}
