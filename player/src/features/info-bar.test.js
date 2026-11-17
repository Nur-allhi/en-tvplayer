import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { INFO_BAR_HIDE_MS, contract, showInfoBar, onChannelChanged, startInfoBar, stopInfoBar } from './info-bar.js';
import { FEATURES, isEnabled } from '../app/plugins.js';
import { uiState } from '../state/index.js';

describe('info-bar plugin', () => {
  const original = isEnabled('infoBar');

  beforeEach(() => {
    stopInfoBar();
    FEATURES.infoBar.enabled = true;
  });

  afterEach(() => {
    stopInfoBar();
    FEATURES.infoBar.enabled = original;
    vi.useRealTimers();
  });

  it('declares a contract with its DOM id and hide delay', () => {
    expect(contract.id).toBe('infoBar');
    expect(contract.owns).toContain('#info-bar');
    expect(INFO_BAR_HIDE_MS).toBe(8000);
  });

  it('is enabled by default', () => {
    expect(isEnabled('infoBar')).toBe(true);
  });

  it('showInfoBar is a no-op without a DOM and returns empty', () => {
    expect(showInfoBar({ name: 'CNN' }, {}, '20:15')).toBe('');
  });

  it('onChannelChanged is a no-op without a DOM', () => {
    expect(() => onChannelChanged(3, [{ name: 'CNN' }])).not.toThrow();
  });

  it('ignores a repeated channel index', () => {
    expect(() => {
      onChannelChanged(2, [{}, {}, { name: 'CNN' }]);
      onChannelChanged(2, [{}, {}, { name: 'CNN' }]);
    }).not.toThrow();
  });

  it('does nothing when the feature is disabled', () => {
    FEATURES.infoBar.enabled = false;
    expect(() => onChannelChanged(1, [{}, { name: 'CNN' }])).not.toThrow();
  });

  it('subscribes to the UI store when started', () => {
    const off = startInfoBar();
    expect(typeof off).toBe('function');
    stopInfoBar();
  });

  it('reacts to a currentIndex change without a DOM', () => {
    uiState.set({ currentIndex: 7, channels: [{}, {}, {}, {}, {}, {}, {}, { name: 'BBC' }] });
    startInfoBar();
    expect(() => uiState.set({ currentIndex: 0 })).not.toThrow();
    stopInfoBar();
  });
});
