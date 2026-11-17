import { describe, it, expect } from 'vitest';
import { normalizeMediaUrl, mediaId, episodeId } from './media-id.js';

describe('normalizeMediaUrl', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeMediaUrl('  https://host/a.mp4  ')).toBe('https://host/a.mp4');
  });

  it('drops a volatile query string and fragment', () => {
    expect(normalizeMediaUrl('https://host/a.mp4?token=abc&x=1#frag')).toBe('https://host/a.mp4');
  });

  it('lower-cases scheme and host but keeps the path case', () => {
    expect(normalizeMediaUrl('HTTPS://HOST/Path/Movie.MP4')).toBe('https://host/Path/Movie.MP4');
  });

  it('removes trailing slashes', () => {
    expect(normalizeMediaUrl('https://host/folder/')).toBe('https://host/folder');
  });

  it('returns an empty string for a non-string input', () => {
    expect(normalizeMediaUrl(null)).toBe('');
    expect(normalizeMediaUrl(42)).toBe('');
  });
});

describe('mediaId', () => {
  it('is a stable prefixed hash of a URL', () => {
    const id = mediaId('https://host/a.mp4');
    expect(id).toMatch(/^m_[0-9a-f]{8}$/);
    expect(mediaId('https://host/a.mp4')).toBe(id);
  });

  it('is independent of token changes — stable across re-fetch', () => {
    const first = mediaId('https://host/a.mp4?token=one');
    const second = mediaId('https://host/a.mp4?token=two#x');
    expect(second).toBe(first);
  });

  it('is independent of ordering', () => {
    const ids = ['https://host/a.mp4', 'https://host/b.mp4', 'https://host/c.mp4'].map(mediaId);
    const reversed = ['https://host/c.mp4', 'https://host/b.mp4', 'https://host/a.mp4'].map(mediaId);
    expect(reversed).toEqual([...ids].reverse());
    expect(new Set(ids).size).toBe(3);
  });

  it('distinguishes different paths', () => {
    expect(mediaId('https://host/a.mp4')).not.toBe(mediaId('https://host/b.mp4'));
  });

  it('treats case-only host differences as the same media', () => {
    expect(mediaId('https://HOST/a.mp4')).toBe(mediaId('https://host/a.mp4'));
  });

  it('returns an empty string for an empty URL', () => {
    expect(mediaId('')).toBe('');
    expect(mediaId('???')).toBe('');
  });
});

describe('episodeId', () => {
  it('derives a deterministic id from the series id, season and number', () => {
    const series = mediaId('https://host/series.m3u8');
    expect(episodeId(series, 1, 2)).toBe(series + '_s1e2');
    expect(episodeId(series, 1, 2)).toBe(episodeId(series, 1, 2));
    expect(episodeId(series, 1, 2)).not.toBe(episodeId(series, 2, 1));
  });
});
