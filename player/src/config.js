const SETTINGS_KEY = 'en_settings';
const PROXY_OVERRIDES_KEY = 'en_proxy_overrides';

export const APP_VERSION = __APP_VERSION__;

const settingsDefaults = {
  playlists: [],
  activePlaylistIndex: -1,
  proxyUrl: 'http://localhost:5000/proxy/',
  channels: [],
  channelsFetched: null,
  autoQuality: true,
  autoRefreshPlaylist: true,
  updateCheck: false,
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

export function getProxyOverrides() {
  try {
    const raw = localStorage.getItem(PROXY_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setProxyOverride(url, enabled) {
  const overrides = getProxyOverrides();
  overrides[url] = enabled;
  try {
    localStorage.setItem(PROXY_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.warn('Failed to save proxy override:', e);
  }
  return overrides;
}

export default {
  useProxy: true,
  player: {
    streaming: {
      bufferingGoal: 15,
      rebufferingGoal: 5,
      bufferBehind: 30,
      segmentPrefetchLimit: 3,
      retryParameters: {
        maxAttempts: 8,
        baseDelay: 500,
        backoffFactor: 2,
        fuzzFactor: 0.5,
        timeout: 10000,
      },
    },
    abr: {
      enabled: true,
      switchInterval: 3,
      bandwidthUpgradeTarget: 0.6,
      bandwidthDowngradeTarget: 0.85,
      defaultBandwidthEstimate: 1500000,
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
