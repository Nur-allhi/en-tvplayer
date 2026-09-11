const SETTINGS_KEY = 'en_settings';

export const APP_VERSION = __APP_VERSION__;

const settingsDefaults = {
  playlists: [],
  activePlaylistIndex: -1,
  channels: [],
  channelsFetched: null,
  autoQuality: true,
  autoRefreshPlaylist: true,
  updateCheck: false,
  showWatermark: true,
  showResolutionBadge: true,
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const defaults = { ...settingsDefaults, playlists: [] };
    const s = raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    // Migration from legacy single playlistUrl
    if ((!s.playlists || s.playlists.length === 0) && s.playlistUrl) {
      s.playlists = [{ name: 'Playlist 1', url: s.playlistUrl }];
      s.activePlaylistIndex = 0;
      delete s.playlistUrl;
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
    }
    // Backfill per-playlist dates for entries saved before date tracking.
    if (Array.isArray(s.playlists) && s.playlists.length > 0) {
      let dirty = false;
      const fallback = s.channelsFetched || null;
      for (const p of s.playlists) {
        if (!p || typeof p !== 'object') continue;
        if (!p.addedAt) { p.addedAt = fallback || new Date().toISOString(); dirty = true; }
        if (!('lastPlayedAt' in p)) { p.lastPlayedAt = null; dirty = true; }
      }
      if (dirty) {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
      }
    }
    return s;
  } catch {
    return { ...settingsDefaults, playlists: [] };
  }
}

export function getActivePlaylist() {
  const s = getSettings();
  if (s.activePlaylistIndex >= 0 && s.activePlaylistIndex < s.playlists.length) {
    return s.playlists[s.activePlaylistIndex];
  }
  return null;
}

export function saveSettings(partial) {
  const current = getSettings();
  const merged = { ...current, ...partial };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
  return merged;
}

export default {
  player: {
    streaming: {
      bufferingGoal: 15,
      rebufferingGoal: 5,
      bufferBehind: 30,
      // BUG-021: relay servers rate-limit aggressive clients (403 storms).
      // Fewer parallel/prefetch requests and fewer retries stay under the ban.
      segmentPrefetchLimit: 2,
      retryParameters: {
        maxAttempts: 5,
        baseDelay: 800,
        backoffFactor: 2,
        fuzzFactor: 0.5,
        timeout: 10000,
      },
    },
    abr: {
      enabled: true,
      switchInterval: 3,
      // Upgrade math (SimpleAbrManager): climbs when estimate > nextRung /
      // upgradeTarget, drops when estimate < current / downgradeTarget. So a
      // HIGHER upgradeTarget climbs easier, a HIGHER downgradeTarget drops
      // calmer. (0.6/0.85 had it backwards and ratcheted into SD.)
      bandwidthUpgradeTarget: 0.9,
      bandwidthDowngradeTarget: 0.95,
      // BUG-019: start pessimistic so Auto mode opens on the lowest rung for
      // fast first frame, then ABR ramps up to what the line sustains.
      defaultBandwidthEstimate: 500000,
    },
    manifest: {
      retryParameters: {
        maxAttempts: 3,
        baseDelay: 500,
        backoffFactor: 2,
        fuzzFactor: 0.5,
        timeout: 10000,
      },
      hls: {
        ignoreManifestProgramDateTime: false,
      },
    },
  },
};
