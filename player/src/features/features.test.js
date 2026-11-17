import { describe, it, expect } from 'vitest';
import { isLocalHost, shouldShow, contract as proxyContract } from './proxy-toggle.js';
import { contract as tizenContract } from './tizen-compat.js';
import { contract as searchContract } from './search.js';
import { contract as avplayContract } from './avplay.js';

// T-172: every migrated feature carries the same contract shape so the hub
// never needs to know its internals. Pure helpers are tested in node env.

describe('proxy feature — host gate', () => {
  it('allows loopback and localhost hosts', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', 'test.local']) {
      expect(isLocalHost(host)).toBe(true);
    }
  });

  it('allows private LAN ranges', () => {
    for (const host of ['10.0.0.5', '192.168.1.20', '172.16.0.1', '172.31.255.1']) {
      expect(isLocalHost(host)).toBe(true);
    }
  });

  it('rejects public and empty hosts', () => {
    for (const host of ['', 'example.com', '8.8.8.8', '172.32.0.1', 'localhost.example.com']) {
      expect(isLocalHost(host)).toBe(false);
    }
  });

  it('requires both a local host and the settings opt-in', () => {
    expect(shouldShow('localhost', { showProxyMenu: true })).toBe(true);
    expect(shouldShow('example.com', { showProxyMenu: true })).toBe(false);
    expect(shouldShow('localhost', { showProxyMenu: false })).toBe(false);
    expect(shouldShow('localhost', {})).toBe(false);
  });
});

describe('feature contracts', () => {
  const contracts = [proxyContract, tizenContract, searchContract, avplayContract];

  it('every migrated feature declares a contract', () => {
    for (const contract of contracts) {
      expect(contract.id).toBeTruthy();
      expect(Array.isArray(contract.owns)).toBe(true);
      expect(Array.isArray(contract.routes)).toBe(true);
      expect(Array.isArray(contract.menuEntries)).toBe(true);
    }
  });

  it('uses unique feature ids', () => {
    expect(new Set(contracts.map((c) => c.id)).size).toBe(contracts.length);
  });

  it('documents what the proxy feature owns', () => {
    expect(proxyContract.id).toBe('proxyTesting');
    expect(proxyContract.owns).toContain('#proxy-toggle-btn');
  });

  it('documents the tizen key and back-key bindings', () => {
    expect(tizenContract.owns).toContain('tizenhwkey back');
    expect(tizenContract.owns).toContain('tvinputdevice.registerKey');
  });

  it('documents the search remote route', () => {
    expect(searchContract.id).toBe('search');
    expect(searchContract.routes).toContain('search');
  });

  it('documents the avplay native surface', () => {
    expect(avplayContract.owns).toContain('#avplayer');
  });
});
