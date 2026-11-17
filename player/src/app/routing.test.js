import { describe, it, expect, beforeEach } from 'vitest';
import { FEATURES, bindRoute, getEnabledRoutes, isActionEnabled } from './plugins.js';
import { dispatchFeatureRoute } from './route-dispatch.js';

// T-173: a feature binds its own remote action at module load. No edit to
// app/remote.js is needed, and disabling the feature removes the binding.

const pristine = JSON.parse(JSON.stringify(FEATURES));

beforeEach(() => {
  for (const id of Object.keys(FEATURES)) delete FEATURES[id];
  Object.assign(FEATURES, JSON.parse(JSON.stringify(pristine)));
});

describe('bindRoute', () => {
  it('lets a feature own an action', () => {
    const handler = () => 'owned';
    bindRoute('search', 'red', handler);
    expect(getEnabledRoutes().red).toBe(handler);
  });

  it('records the action in the feature key list', () => {
    bindRoute('search', 'red', () => {});
    expect(FEATURES.search.keys).toContain('red');
  });

  it('returns an unbind function', () => {
    const unbind = bindRoute('search', 'red', () => {});
    expect(typeof unbind).toBe('function');
    unbind();
    expect(getEnabledRoutes()).not.toHaveProperty('red');
  });

  it('re-binding an action replaces the handler', () => {
    const first = () => 'first';
    const second = () => 'second';
    bindRoute('search', 'red', first);
    bindRoute('search', 'red', second);
    expect(getEnabledRoutes().red).toBe(second);
  });

  it('ignores an unknown feature', () => {
    expect(() => bindRoute('missing', 'red', () => {})).not.toThrow();
    expect(getEnabledRoutes()).toEqual({});
  });

  it('ignores a non-function handler', () => {
    bindRoute('search', 'red', null);
    expect(getEnabledRoutes()).toEqual({});
  });
});

describe('dispatchFeatureRoute', () => {
  it('calls a registered route with the action value', () => {
    let seen;
    bindRoute('search', 'green', (value) => {
      seen = value;
    });
    expect(dispatchFeatureRoute('green', 7)).toBe(true);
    expect(seen).toBe(7);
  });

  it('returns false when no feature owns the action', () => {
    expect(dispatchFeatureRoute('unbound', 1)).toBe(false);
  });

  it('does not dispatch a disabled feature route', () => {
    bindRoute('search', 'green', () => {
      throw new Error('must not run');
    });
    FEATURES.search.enabled = false;
    expect(dispatchFeatureRoute('green', 1)).toBe(false);
  });

  it('keeps the key disabled through isActionEnabled', () => {
    bindRoute('search', 'green', () => {});
    FEATURES.search.enabled = false;
    expect(isActionEnabled('green')).toBe(false);
  });

  it('restores dispatch after the feature is re-enabled', () => {
    let calls = 0;
    bindRoute('search', 'green', () => calls++);
    FEATURES.search.enabled = false;
    dispatchFeatureRoute('green');
    FEATURES.search.enabled = true;
    expect(dispatchFeatureRoute('green')).toBe(true);
    expect(calls).toBe(1);
  });
});
