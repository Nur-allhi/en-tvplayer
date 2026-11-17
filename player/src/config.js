const SETTINGS_KEY = 'en_settings';

export const APP_VERSION = __APP_VERSION__;

// v4 settings schema (T-186). v3 had no schemaVersion. Migrations are additive:
// new keys get defaults, every existing key survives, and the en_settings key
// name never changes — changing it would orphan every installed TV.
export const SCHEMA_VERSION = 4;

const FEATURE_DEFAULTS = { favorites: true, infoBar: true, vod: true };

// Pure, idempotent v3 → v4 upgrade on a parsed settings object. `changed` tells
// the caller (getSettings) whether it needs to persist the result.
export function migrateSettings(input) {
  const s = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  let changed = false;

  if (!s.schemaVersion || s.schemaVersion < SCHEMA_VERSION) {
    if (!Array.isArray(s.movies)) {
      s.movies = [];
      changed = true;
    }
    if (!Array.isArray(s.favorites)) {
      s.favorites = [];
      changed = true;
    }
    if (!s.features || typeof s.features !== 'object' || Array.isArray(s.features)) {
      s.features = { ...FEATURE_DEFAULTS };
      changed = true;
    } else {
      for (const [key, value] of Object.entries(FEATURE_DEFAULTS)) {
        if (!(key in s.features)) {
          s.features[key] = value;
          changed = true;
        }
      }
    }
    s.schemaVersion = SCHEMA_VERSION;
    changed = true;
  }

  return { settings: s, changed };
}

const settingsDefaults = {
  playlists: [],
  activePlaylistIndex: -1,
  channels: [],
  channelsFetched: null,
  autoQuality: true,
  autoRefreshPlaylist: true,
  channelSort: 'provider',
  updateCheck: false,
  showWatermark: true,
  showResolutionBadge: true,
  // Desktop test relay (branch-only, never shipped): base URL + per-channel
  // opt-ins keyed by channel URL.
  proxyUrl: 'https://localhost:5001',
  proxyChannels: {},
  showProxyMenu: false,
  hiddenGroups: [],
  // Resume: last playing channel (stable URL, not index) + group view.
  lastChannelUrl: null,
  lastGroup: null,
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const defaults = { ...settingsDefaults, playlists: [] };
    const parsed = raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    const migrated = migrateSettings(parsed);
    const s = migrated.settings;
    let dirty = migrated.changed;
    // Migration from legacy single playlistUrl
    if ((!s.playlists || s.playlists.length === 0) && s.playlistUrl) {
      s.playlists = [{ name: 'Playlist 1', url: s.playlistUrl }];
      s.activePlaylistIndex = 0;
      delete s.playlistUrl;
      dirty = true;
    }
    // Backfill per-playlist dates for entries saved before date tracking.
    if (Array.isArray(s.playlists) && s.playlists.length > 0) {
      const fallback = s.channelsFetched || null;
      for (const p of s.playlists) {
        if (!p || typeof p !== 'object') continue;
        if (!p.addedAt) {
          p.addedAt = fallback || new Date().toISOString();
          dirty = true;
        }
        if (!('lastPlayedAt' in p)) {
          p.lastPlayedAt = null;
          dirty = true;
        }
      }
    }
    if (dirty) {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
      } catch {}
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

export function getHiddenGroups() {
  try {
    const hg = getSettings().hiddenGroups;
    return Array.isArray(hg) ? hg : [];
  } catch {
    return [];
  }
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
      // Upstream defaults (10/8): a bigger goal piles a heavier transmux
      // burst onto the TV's main thread per tune — keys look dead while it
      // chews — and re-evaluating ABR every 3s churns variants on jittery
      // relays (play → buffer seconds later → repeat). Calm both.
      bufferingGoal: 10,
      // Upstream default: start/resume playback after 2s of buffer instead
      // of 5s — on slow relays the old value added seconds of black before
      // the first frame with no reliability gain (ABR still ramps from low).
      rebufferingGoal: 2,
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
      // Upstream default: re-pick at most every 8s so a jittery relay does
      // not flap between variants (each switch rebuffers + retransmuxes).
      switchInterval: 8,
      // Upgrade math (SimpleAbrManager): climbs when estimate > nextRung /
      // upgradeTarget, drops when estimate < current / downgradeTarget. So a
      // HIGHER upgradeTarget climbs easier, a HIGHER downgradeTarget drops
      // calmer. (0.6/0.85 had it backwards and ratcheted into SD.)
      bandwidthUpgradeTarget: 0.9,
      bandwidthDowngradeTarget: 0.95,
      // BUG-019: start pessimistic so Auto mode opens on the lowest rung for
      // fast first frame, then ABR ramps up to what the line sustains.
      defaultBandwidthEstimate: 500000,
      // Auto sticks to FHD: top 2K/4K variants stall to black on Tizen
      // (decoder or bandwidth), while manual 1080 plays fine. Soft cap —
      // manual selection can still exceed it.
      restrictions: { maxHeight: 1080 },
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
