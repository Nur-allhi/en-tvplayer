import { describe, it, expect, afterEach } from 'vitest';
import { FEATURES, isEnabled, disabledUiIds, isActionEnabled } from './plugins.js';

const original = Object.fromEntries(Object.entries(FEATURES).map(([k, v]) => [k, v.enabled]));

afterEach(() => {
  for (const [name, enabled] of Object.entries(original)) FEATURES[name].enabled = enabled;
});

describe('feature registry', () => {
  it('declares each feature with a ui list and a keys list', () => {
    for (const feature of Object.values(FEATURES)) {
      expect(Array.isArray(feature.ui)).toBe(true);
      expect(Array.isArray(feature.keys)).toBe(true);
      expect(typeof feature.enabled).toBe('boolean');
    }
  });

  it('reports enabled features by name', () => {
    expect(isEnabled('search')).toBe(true);
    expect(isEnabled('favorites')).toBe(false);
  });

  it('returns false for an unknown feature', () => {
    expect(isEnabled('nope')).toBe(false);
  });

  it('lets a feature be disabled by its own flag', () => {
    FEATURES.proxy.enabled = false;
    expect(isEnabled('proxy')).toBe(false);
  });

  it('collects UI ids only from disabled features', () => {
    FEATURES.vod.enabled = true;
    FEATURES.proxy.enabled = false;
    expect(disabledUiIds()).toEqual(['proxy-toggle-btn', 'proxy-testing-label']);
  });

  it('omits UI ids while a feature is enabled', () => {
    expect(disabledUiIds()).not.toContain('proxy-toggle-btn');
  });

  it('blocks a remote key owned by a disabled feature', () => {
    FEATURES.favorites.enabled = true;
    expect(isActionEnabled('red')).toBe(true);
    FEATURES.favorites.enabled = false;
    expect(isActionEnabled('red')).toBe(false);
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
});
