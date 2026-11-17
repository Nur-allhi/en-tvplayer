import { describe, it, expect } from 'vitest';
import { streamTypeFor, buildInfoBar, formatInfoBar } from './info-bar.js';

describe('streamTypeFor', () => {
  it('uppercases an m3u8 extension', () => {
    expect(streamTypeFor('http://x/live.m3u8')).toBe('M3U8');
  });

  it('ignores query strings', () => {
    expect(streamTypeFor('http://x/live.mpd?token=abc')).toBe('MPD');
  });

  it('ignores fragments', () => {
    expect(streamTypeFor('http://x/live.ts#part')).toBe('TS');
  });

  it('returns an empty string for a url without an extension', () => {
    expect(streamTypeFor('http://x/live')).toBe('');
  });

  it('returns an empty string for a missing url', () => {
    expect(streamTypeFor()).toBe('');
    expect(streamTypeFor('')).toBe('');
  });

  it('rejects implausibly long extensions', () => {
    expect(streamTypeFor('http://x/a.abcdefghijk')).toBe('');
  });
});

describe('buildInfoBar', () => {
  it('copies the channel name and number', () => {
    const info = buildInfoBar({ name: 'CNN', channelNumber: 5 });
    expect(info.name).toBe('CNN');
    expect(info.channelNumber).toBe('5');
  });

  it('derives the stream type from the url', () => {
    expect(buildInfoBar({ url: 'http://x/a.m3u8' }).streamType).toBe('M3U8');
  });

  it('prefers an explicit streamType override', () => {
    expect(buildInfoBar({ url: 'http://x/a.m3u8' }, { streamType: 'DASH' }).streamType).toBe('DASH');
  });

  it('carries resolution and clock overrides', () => {
    const info = buildInfoBar({}, { resolution: '1920x1080', clock: '20:15' });
    expect(info.resolution).toBe('1920x1080');
    expect(info.clock).toBe('20:15');
  });

  it('defaults missing fields to empty strings', () => {
    const info = buildInfoBar();
    expect(info).toEqual({ name: '', group: '', resolution: '', streamType: '', channelNumber: '', clock: '' });
  });

  it('ignores non-string meta values', () => {
    expect(buildInfoBar({}, { resolution: 42, clock: null }).resolution).toBe('');
  });
});

describe('formatInfoBar', () => {
  it('joins present fields with a bullet separator', () => {
    const text = formatInfoBar(
      { name: 'CNN', group: 'News', channelNumber: 5, url: 'http://x/a.m3u8' },
      { resolution: '1080p', clock: '20:15' },
    );
    expect(text).toBe('5  •  CNN  •  [News]  •  1080p  •  M3U8  •  20:15');
  });

  it('omits empty fields instead of leaving separators', () => {
    expect(formatInfoBar({ name: 'CNN' })).toBe('CNN');
  });

  it('returns an empty string for an empty channel', () => {
    expect(formatInfoBar()).toBe('');
  });

  it('shows group in brackets', () => {
    expect(formatInfoBar({ group: 'Sports' })).toBe('[Sports]');
  });
});
