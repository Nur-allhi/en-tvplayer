import { describe, it, expect, beforeEach } from 'vitest';
import {
  FEATURES,
  isEnabled,
  getEnabledFeatures,
  getEnabledRoutes,
  getEnabledMenuEntries,
  registerFeature,
  disabledUiIds,
  isActionEnabled,
  guardAction,
} from './plugins.js';

// T-171: the registry is the single coupling point for features. These tests
// pin the acceptance contract — flipping `enabled` in FEATURES is the only
// edit needed to drop a feature's remote routes and sidebar entries.

const pristine = JSON.parse(JSON.stringify(FEATURES));

beforeEach(() => {
  for (const id of Object.keys(FEATURES)) delete FEATURES[id];
  Object.assign(FEATURES, JSON.parse(JSON.stringify(pristine)));
});

describe('feature catalogue', () => {
  it('lists the feature ids planned in v4.PLAN.md §3.3', () => {
    for (const id of ['search', 'favorites', 'infoBar', 'vod']) {
      expect(FEATURES).toHaveProperty(id);
    }
  });

  it('enables a known feature by default', () => {
    expect(isEnabled('search')).toBe(true);
  });

  it('reports an unregistered id as disabled', () => {
    expect(isEnabled('missing')).toBe(false);
  });

  it('reports a feature as disabled when its flag is false', () => {
    FEATURES.search.enabled = false;
    expect(isEnabled('search')).toBe(false);
  });

  it('treats a missing enabled flag as disabled', () => {
    FEATURES.search = {};
    expect(isEnabled('search')).toBe(false);
  });

  it('lists only enabled feature ids', () => {
    FEATURES.vod.enabled = false;
    expect(getEnabledFeatures()).not.toContain('vod');
    expect(getEnabledFeatures()).toContain('search');
  });

  it('lists no features when all are disabled', () => {
    for (const feature of Object.values(FEATURES)) feature.enabled = false;
    expect(getEnabledFeatures()).toEqual([]);
  });
});

describe('remote routes', () => {
  it('collects routes from enabled features', () => {
    FEATURES.search.routes = { find: () => 'search' };
    expect(getEnabledRoutes()).toHaveProperty('find');
  });

  it('ignores routes from disabled features', () => {
    FEATURES.search.routes = { find: () => 'search' };
    FEATURES.search.enabled = false;
    expect(getEnabledRoutes()).not.toHaveProperty('find');
  });

  it('returns an empty object when nothing contributes routes', () => {
    expect(getEnabledRoutes()).toEqual({});
  });

  it('lets a later enabled feature win a route collision', () => {
    FEATURES.search.routes = { find: () => 'first' };
    FEATURES.vod.routes = { find: () => 'second' };
    expect(getEnabledRoutes().find()).toBe('second');
  });
});

describe('sidebar menu entries', () => {
  it('collects menu entries from enabled features', () => {
    FEATURES.search.menuEntries = [{ id: 'search' }];
    expect(getEnabledMenuEntries()).toEqual([{ id: 'search' }]);
  });

  it('ignores menu entries from disabled features', () => {
    FEATURES.search.menuEntries = [{ id: 'search' }];
    FEATURES.search.enabled = false;
    expect(getEnabledMenuEntries()).toEqual([]);
  });

  it('concats entries from several features in catalogue order', () => {
    FEATURES.search.menuEntries = [{ id: 'search' }];
    FEATURES.favorites.menuEntries = [{ id: 'favorites' }];
    expect(getEnabledMenuEntries().map((entry) => entry.id)).toEqual(['search', 'favorites']);
  });
});

describe('disabling a feature', () => {
  it('removes its remote routes and UI entries with no other edit', () => {
    FEATURES.search.routes = { find: () => 'search' };
    FEATURES.search.menuEntries = [{ id: 'search' }];
    FEATURES.search.enabled = false;
    expect(getEnabledRoutes()).not.toHaveProperty('find');
    expect(getEnabledMenuEntries()).toEqual([]);
  });

  it('restores both when re-enabled', () => {
    FEATURES.search.routes = { find: () => 'search' };
    FEATURES.search.menuEntries = [{ id: 'search' }];
    FEATURES.search.enabled = false;
    FEATURES.search.enabled = true;
    expect(getEnabledRoutes()).toHaveProperty('find');
    expect(getEnabledMenuEntries()).toEqual([{ id: 'search' }]);
  });

  it('does not disturb another enabled feature', () => {
    FEATURES.favorites.menuEntries = [{ id: 'favorites' }];
    FEATURES.search.enabled = false;
    expect(getEnabledMenuEntries().map((entry) => entry.id)).toEqual(['favorites']);
  });
});

describe('registerFeature', () => {
  it('adds a new feature enabled by default', () => {
    registerFeature('proxyTesting', { menuEntries: [{ id: 'proxy' }] });
    expect(isEnabled('proxyTesting')).toBe(true);
    expect(getEnabledMenuEntries()).toEqual([{ id: 'proxy' }]);
  });

  it('keeps a feature disabled when the config says so', () => {
    registerFeature('off', { enabled: false, routes: { x: () => {} } });
    expect(isEnabled('off')).toBe(false);
    expect(getEnabledRoutes()).toEqual({});
  });

  it('replaces an existing feature config', () => {
    registerFeature('search', { enabled: true, routes: { new: () => {} } });
    expect(getEnabledRoutes()).toHaveProperty('new');
  });

  it('does not leak state between registrations', () => {
    registerFeature('a', { routes: { a: () => {} } });
    registerFeature('b', { routes: { b: () => {} } });
    expect(Object.keys(getEnabledRoutes())).toEqual(['a', 'b']);
  });
});

describe('feature-owned DOM and keys', () => {
  it('declares each feature with a ui list and a keys list', () => {
    for (const feature of Object.values(FEATURES)) {
      expect(Array.isArray(feature.ui)).toBe(true);
      expect(Array.isArray(feature.keys)).toBe(true);
      expect(typeof feature.enabled).toBe('boolean');
    }
  });

  it('collects UI ids only from disabled features', () => {
    FEATURES.vod.enabled = true;
    FEATURES.proxyTesting.enabled = false;
    expect(disabledUiIds()).toEqual(['proxy-toggle-btn', 'proxy-testing-label']);
  });

  it('omits UI ids while a feature is enabled', () => {
    expect(disabledUiIds()).not.toContain('proxy-toggle-btn');
  });

  it('blocks a remote key owned by a disabled feature', () => {
    FEATURES.favorites.enabled = false;
    expect(isActionEnabled('red')).toBe(false);
    FEATURES.favorites.enabled = true;
    expect(isActionEnabled('red')).toBe(true);
  });

  it('keeps keys of enabled features available', () => {
    expect(isActionEnabled('proxy')).toBe(true);
    expect(isActionEnabled('playpause')).toBe(true);
  });

  it('does not block a key no feature owns', () => {
    expect(isActionEnabled('up')).toBe(true);
    expect(isActionEnabled('select')).toBe(true);
  });

  it('blocks keys from every disabled feature at once', () => {
    FEATURES.favorites.enabled = false;
    FEATURES.vod.enabled = false;
    expect(isActionEnabled('red')).toBe(false);
    expect(isActionEnabled('vod')).toBe(false);
  });

  it('guardAction forwards enabled actions and drops disabled ones', () => {
    const seen = [];
    const dispatch = guardAction((action) => seen.push(action));
    dispatch('up');
    FEATURES.favorites.enabled = false;
    dispatch('red');
    expect(seen).toEqual(['up']);
  });
});
