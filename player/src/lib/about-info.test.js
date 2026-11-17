import { describe, it, expect } from 'vitest';
import { aboutInfo } from './about-info.js';

const tizenCaps = { isTizen: true, webApiVersion: 6.5, hasAvplay: true };
const browserCaps = { isTizen: false, webApiVersion: 5, hasAvplay: false };

const rows = (list) => Object.fromEntries(list.map((r) => [r.label, r.value]));

describe('aboutInfo', () => {
  it('reports the app version', () => {
    const info = rows(aboutInfo({ version: '4.0.0', caps: tizenCaps, engine: 'shaka' }));
    expect(info.App).toBe('EN IPTV Player');
    expect(info.Version).toBe('4.0.0');
  });

  it('uses unknown when no version is supplied', () => {
    expect(rows(aboutInfo({ caps: browserCaps })).Version).toBe('unknown');
  });

  it('reports the Tizen API version on a TV', () => {
    const info = rows(aboutInfo({ version: '1', caps: tizenCaps, engine: 'shaka' }));
    expect(info.Platform).toBe('Samsung Tizen');
    expect(info['TV API version']).toBe('6.5');
  });

  it('says it is not a Tizen TV in a browser', () => {
    const info = rows(aboutInfo({ version: '1', caps: browserCaps, engine: 'none' }));
    expect(info.Platform).toBe('Browser');
    expect(info['TV API version']).toBe('Not a Tizen TV');
  });

  it.each([
    ['shaka', 'Shaka'],
    ['native', 'Native'],
    ['none', 'Browser'],
  ])('labels the %s engine as %s', (engine, label) => {
    expect(rows(aboutInfo({ version: '1', caps: tizenCaps, engine })).Engine).toBe(label);
  });

  it('reports AVPlay availability', () => {
    expect(rows(aboutInfo({ version: '1', caps: tizenCaps, engine: 'native' })).AVPlay).toBe('Available');
    expect(rows(aboutInfo({ version: '1', caps: browserCaps, engine: 'shaka' })).AVPlay).toBe('Not available');
  });

  it('reports native-playback support from the player probe', () => {
    expect(
      rows(aboutInfo({ version: '1', caps: tizenCaps, engine: 'shaka', nativeAvailable: true }))['Native playback'],
    ).toBe('Available');
    expect(
      rows(aboutInfo({ version: '1', caps: tizenCaps, engine: 'shaka', nativeAvailable: false }))['Native playback'],
    ).toBe('Not available');
  });

  it('handles a missing capability object', () => {
    const info = rows(aboutInfo({}));
    expect(info.Platform).toBe('Browser');
    expect(info.Engine).toBe('Browser');
    expect(info.AVPlay).toBe('Not available');
  });
});
