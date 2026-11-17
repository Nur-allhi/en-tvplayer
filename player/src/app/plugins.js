// Feature registry (T-171, docs/v4.PLAN.md §3.3). Pure — no DOM, no imports.
//
// This is the single coupling point for features: a feature declares its
// remote routes and sidebar rows here, and consumers read only the enabled
// views below. Flipping `enabled` in FEATURES is therefore the only edit
// required to remove a feature's bindings. T-172 migrates the existing
// hard-wired features into this registry; loaders are added with them, since
// no features/ modules exist yet for import() to resolve.

export const FEATURES = {
  search: { enabled: true },
  favorites: { enabled: true },
  infoBar: { enabled: true },
  vod: { enabled: true },
  proxyTesting: { enabled: true },
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
