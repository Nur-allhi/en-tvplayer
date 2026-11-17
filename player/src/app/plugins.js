// Feature registry (T-171/T-172, docs/v4.PLAN.md §3.3). The hub is the only
// coupling point: each feature declares its enabled flag, the DOM ids and
// remote actions it owns, and (for migrated features) a contract and a lazy
// loader. Flipping `enabled` is the only edit needed to remove its bindings.
// Lazy loaders are inlined into the IIFE bundle by Vite's inlineDynamicImports.

import proxyContract from '../features/proxy-toggle.js';
import tizenContract from '../features/tizen-compat.js';
import searchContract from '../features/search.js';
import avplayContract from '../features/avplay.js';

export const FEATURES = {
  search: {
    enabled: true,
    ui: [],
    keys: [],
    contract: searchContract,
    load: () => import('../features/search.js'),
  },
  favorites: { enabled: true, ui: [], keys: ['red'] },
  infoBar: { enabled: true, ui: [], keys: [] },
  vod: { enabled: true, ui: ['vod-entry'], keys: ['vod'] },
  proxyTesting: {
    enabled: true,
    ui: ['proxy-toggle-btn', 'proxy-testing-label'],
    keys: ['proxy'],
    contract: proxyContract,
    load: () => import('../features/proxy-toggle.js'),
  },
  avplay: {
    enabled: true,
    ui: [],
    keys: [],
    contract: avplayContract,
    load: () => import('../features/avplay.js'),
  },
  tizenCompat: {
    enabled: true,
    ui: [],
    keys: [],
    contract: tizenContract,
    load: () => import('../features/tizen-compat.js'),
  },
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

// Same rule for UI: a disabled feature adds no sidebar row.
export function getEnabledMenuEntries() {
  const entries = [];
  for (const [id, feature] of Object.entries(FEATURES)) {
    if (isEnabled(id) && feature.menuEntries) entries.push(...feature.menuEntries);
  }
  return entries;
}

// Used by a feature's own module to declare its contract in one place.
export function registerFeature(id, config = {}) {
  FEATURES[id] = { ...config, enabled: config.enabled !== false };
  return FEATURES[id];
}

// A feature binds its own remote action here, at module load. This is the
// entire integration point — app/remote.js needs no edit for a new binding.
// The returned function unbinds it (used by tests and feature teardown).
export function bindRoute(id, action, handler) {
  const feature = FEATURES[id];
  if (!feature || typeof handler !== 'function') return () => {};
  feature.routes = { ...(feature.routes || {}), [action]: handler };
  feature.keys = [...new Set([...(feature.keys || []), action])];
  return () => {
    if (feature.routes) delete feature.routes[action];
    feature.keys = (feature.keys || []).filter((key) => key !== action);
  };
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
