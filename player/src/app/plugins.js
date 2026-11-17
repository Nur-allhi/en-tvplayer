// Feature registry (T-171, docs/v4.PLAN.md §3.3). The single coupling point
// for features: each entry declares its enabled flag, the DOM ids it owns and
// the remote-action names it binds. Flipping `enabled` is the only edit needed
// to remove a feature's UI and keys. T-172 migrates the hard-wired features
// into modules; their loaders are added with them, since no features/ files
// exist yet for import() to resolve.

export const FEATURES = {
  search: { enabled: true, ui: [], keys: [] },
  favorites: { enabled: true, ui: [], keys: ['red'] },
  infoBar: { enabled: true, ui: [], keys: [] },
  vod: { enabled: true, ui: ['vod-entry'], keys: ['vod'] },
  proxyTesting: {
    enabled: true,
    ui: ['proxy-toggle-btn', 'proxy-testing-label'],
    keys: ['proxy'],
  },
  avplay: { enabled: true, ui: [], keys: [] },
  tizenCompat: { enabled: true, ui: [], keys: [] },
};

export function isEnabled(id) {
  return FEATURES[id]?.enabled === true;
}

export function getEnabledFeatures() {
  return Object.keys(FEATURES).filter(isEnabled);
}

// Only enabled features contribute routes. T-173's router dispatches through
// this, so a disabled feature owns no key at all.
export function getEnabledRoutes() {
  const routes = {};
  for (const [id, feature] of Object.entries(FEATURES)) {
    if (isEnabled(id) && feature.routes) Object.assign(routes, feature.routes);
  }
  return routes;
}

// Dispatch an action owned by a feature. Returns false when no feature claims
// it, so the existing view handlers remain the default (T-173).
export function dispatchRoute(action, value) {
  const route = getEnabledRoutes()[action];
  if (!route) return false;
  route(value);
  return true;
}

// Same rule for UI: a disabled feature adds no sidebar row.
export function getEnabledMenuEntries() {
  const entries = [];
  for (const [id, feature] of Object.entries(FEATURES)) {
    if (isEnabled(id) && feature.menuEntries) entries.push(...feature.menuEntries);
  }
  return entries;
}

// Used by a feature's own module (T-172+) to declare its contract in one place.
export function registerFeature(id, config = {}) {
  FEATURES[id] = { ...config, enabled: config.enabled !== false };
  return FEATURES[id];
}

export function disabledUiIds() {
  const ids = [];
  for (const feature of Object.values(FEATURES)) {
    if (!feature.enabled) ids.push(...(feature.ui || []));
  }
  return ids;
}

export function isActionEnabled(action) {
  for (const feature of Object.values(FEATURES)) {
    if (!feature.enabled && (feature.keys || []).includes(action)) return false;
  }
  return true;
}

// One guard for every key: a disabled feature's remote binding disappears
// with its flag, without touching any of the handlers in remote.js.
export function guardAction(callback) {
  return (action, value) => {
    if (isActionEnabled(action)) callback(action, value);
  };
}

// Hides the DOM owned by disabled features. Called once at boot by app/index.js.
export function applyFeatureFlags() {
  let hidden = 0;
  for (const id of disabledUiIds()) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) {
      el.classList.add('hidden');
      hidden += 1;
    }
  }
  return hidden;
}
