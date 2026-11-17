import { describe, it, expect } from 'vitest';
import { normalizeUrl, hashUrl, mediaId, episodeId } from './media-id.js';

describe('normalizeUrl', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  https://a.example/x.m3u8  ')).toBe('https://a.example/x.m3u8');
  });

  it('lowercases the scheme and host but keeps the path case', () => {
    expect(normalizeUrl('HTTPS://A.Example/Movie.M3U8')).toBe('https://a.example/Movie.M3U8');
  });

  it('drops the fragment', () => {
    expect(normalizeUrl('https://a.example/x.m3u8#part')).toBe('https://a.example/x.m3u8');
  });

  it('sorts query keys so reordered params hash the same', () => {
    expect(normalizeUrl('https://a.example/x?b=2&a=1')).toBe(normalizeUrl('https://a.example/x?a=1&b=2'));
  });

  it('strips trailing slashes', () => {
    expect(normalizeUrl('https://a.example/x/')).toBe('https://a.example/x');
  });

  it('handles a non-absolute URL without throwing', () => {
    expect(normalizeUrl('channel/1')).toBe('channel/1');
  });

  it('returns an empty string for missing input', () => {
    expect(normalizeUrl()).toBe('');
    expect(normalizeUrl('   ')).toBe('');
  });
});

describe('hashUrl', () => {
  it('is deterministic', () => {
    expect(hashUrl('abc')).toBe(hashUrl('abc'));
  });

  it('differs for different input', () => {
    expect(hashUrl('abc')).not.toBe(hashUrl('abd'));
  });

  it('returns a fixed-width lowercase hex value', () => {
    expect(hashUrl('abc')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('mediaId', () => {
  it('is stable for the same URL', () => {
    expect(mediaId('https://a.example/x.m3u8')).toBe(mediaId('https://a.example/x.m3u8'));
  });

  it('ignores surrounding whitespace and fragments', () => {
    expect(mediaId(' https://a.example/x.m3u8#1 ')).toBe(mediaId('https://a.example/x.m3u8'));
  });

  it('ignores query parameter order', () => {
    expect(mediaId('https://a.example/x?b=2&a=1')).toBe(mediaId('https://a.example/x?a=1&b=2'));
  });

  it('differs for different URLs', () => {
    expect(mediaId('https://a.example/x')).not.toBe(mediaId('https://a.example/y'));
  });

  it('returns an empty string for an empty URL', () => {
    expect(mediaId('')).toBe('');
  });

  it('is independent of the position in a list', () => {
    const urls = ['https://a.example/1', 'https://a.example/2', 'https://a.example/3'];
    const before = urls.map(mediaId);
    const reordered = [urls[2], urls[0], urls[1]].map(mediaId);
    expect(new Set(reordered)).toEqual(new Set(before));
  });

  it('is unchanged after a simulated re-fetch of the same source', () => {
    const first = mediaId('https://a.example/playlist.m3u8?token=abc');
    const refetched = mediaId('https://a.example/playlist.m3u8?token=abc');
    expect(refetched).toBe(first);
  });
});

describe('episodeId', () => {
  it('combines entry id, season and number', () => {
    expect(episodeId('m-abc', 2, 5)).toBe('m-abc-s2e5');
  });

  it('is stable for the same episode', () => {
    expect(episodeId('m-abc', 1, 1)).toBe(episodeId('m-abc', 1, 1));
  });

  it('differs for different episodes', () => {
    expect(episodeId('m-abc', 1, 1)).not.toBe(episodeId('m-abc', 1, 2));
  });
});
