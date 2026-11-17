// Feature registry (T-171/T-172, docs/v4.PLAN.md §3.3). The hub is the only
// coupling point: each feature declares its contract in features/ and the
// enabled views below are all consumers see. Flipping `enabled` is the only
// edit required to remove a feature's bindings. Lazy loaders are inlined into
// the IIFE bundle by Vite's inlineDynamicImports flag.

import proxyContract from '../features/proxy-toggle.js';
import tizenContract from '../features/tizen-compat.js';
import searchContract from '../features/search.js';
import avplayContract from '../features/avplay.js';

export const FEATURES = {
  search: {
    enabled: true,
    contract: searchContract,
    load: () => import('../features/search.js'),
  },
  favorites: { enabled: true },
  infoBar: { enabled: true },
  vod: { enabled: true },
  proxyTesting: {
    enabled: true,
    contract: proxyContract,
    load: () => import('../features/proxy-toggle.js'),
  },
  tizenCompat: {
    enabled: true,
    contract: tizenContract,
    load: () => import('../features/tizen-compat.js'),
  },
  avplayFallback: {
    enabled: true,
    contract: avplayContract,
    load: () => import('../features/avplay.js'),
  },
};

export function isEnabled(id) {
  return FEATURES[id]?.enabled === true;
}

export function getEnabledFeatures() {
  return Object.keys(FEATURES).filter(isEnabled);
}

// Only enabled features contribute routes. This is what T-173's remote router
// will dispatch through, so a disabled feature owns no key at all.
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

// Used by a feature's own module (T-172+) to declare its contract in one place.
export function registerFeature(id, config = {}) {
  FEATURES[id] = { ...config, enabled: config.enabled !== false };
  return FEATURES[id];
}
