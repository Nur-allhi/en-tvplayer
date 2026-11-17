import { describe, it, expect } from 'vitest';
import { getEnabledRoutes } from '../app/plugins.js';
import * as search from './search.js';
import * as avplay from './avplay.js';
import * as tizenCompat from './tizen-compat.js';
import * as proxy from './proxy.js';

describe('feature boundaries (T-172)', () => {
  it('exposes the search contract from one module', () => {
    for (const name of ['enterSearch', 'exitSearch', 'searchNavigate', 'searchSelect']) {
      expect(typeof search[name]).toBe('function');
    }
  });

  it('exposes the AVPlay engine and native-load contracts', () => {
    for (const name of ['play', 'pause', 'resume', 'stop', 'loadViaAvplay', 'switchToAvplay']) {
      expect(typeof avplay[name]).toBe('function');
    }
  });

  it('exposes the Tizen capability contract', () => {
    for (const name of ['detectCapabilities', 'selectEngine', 'hasTvKeyInput', 'meetsMinimumPlatform']) {
      expect(typeof tizenCompat[name]).toBe('function');
    }
  });

  it('exposes the proxy menu refresh', () => {
    expect(typeof proxy.refreshProxyMenu).toBe('function');
  });

  it('lets a feature add a remote binding from its own module', () => {
    expect(getEnabledRoutes()).toHaveProperty('proxy');
  });
});
