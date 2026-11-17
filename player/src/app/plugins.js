// Feature registry (T-171). The single place a feature is declared. Each
// entry owns the DOM ids and remote-action names it needs, so flipping
// `enabled` removes both its UI and its key bindings without another edit.
// Modules are loaded lazily by dynamic import(); the IIFE build inlines them.

export const FEATURES = {
  search: {
    enabled: true,
    ui: [], // search rows are rendered inside the sidebar, not in index.html
    keys: [],
  },
  proxy: {
    enabled: true,
    ui: ['proxy-toggle-btn', 'proxy-testing-label'],
    keys: ['proxy'],
  },
  avplay: { enabled: true, ui: [], keys: [] },
  tizenCompat: { enabled: true, ui: [], keys: [] },
  favorites: { enabled: false, ui: [], keys: ['red'] },
  infoBar: { enabled: false, ui: [], keys: [] },
  vod: { enabled: false, ui: ['vod-entry'], keys: ['vod'] },
};

export function isEnabled(name) {
  return FEATURES[name]?.enabled === true;
}

export function disabledUiIds() {
  const ids = [];
  for (const feature of Object.values(FEATURES)) {
    if (!feature.enabled) ids.push(...feature.ui);
  }
  return ids;
}

export function isActionEnabled(action) {
  for (const feature of Object.values(FEATURES)) {
    if (!feature.enabled && feature.keys.includes(action)) return false;
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
