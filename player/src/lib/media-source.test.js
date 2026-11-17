import { describe, it, expect } from 'vitest';
import { detectSourceKind, m3uToMediaEntries, parseMediaManifest } from './media-source.js';

const M3U = [
  '#EXTM3U',
  '#EXTINF:-1,Big Buck Bunny',
  'https://host/bbb.mp4',
  '#EXTINF:-1,Tears of Steel',
  'https://host/tos.mp4',
  '',
].join('\n');

describe('M3U playback metadata (T-185)', () => {
  it('carries DRM and headers from a Kodi-style entry', () => {
    const text = [
      '#EXTM3U',
      '#EXTINF:-1,DRM Movie',
      '#KODIPROP:license_key=0123456789abcdef0123456789abcdef:fedcba9876543210fedcba9876543210',
      '#KODIPROP:stream_headers=User-Agent=U',
      'https://host/drm.mpd',
      '',
    ].join('\n');
    const [entry] = m3uToMediaEntries(text);
    expect(entry.drm).toBeTruthy();
    expect(entry.userAgent).toBe('U');
  });
});

describe('detectSourceKind', () => {
  it('recognizes M3U and M3U8 playlists', () => {
    expect(detectSourceKind('https://host/vod.m3u')).toBe('m3u');
    expect(detectSourceKind('https://host/vod.m3u8?token=abc')).toBe('m3u');
  });

  it('recognizes JSON manifests', () => {
    expect(detectSourceKind('https://host/library.json')).toBe('json');
  });

  it('treats a plain HTTP link as a direct stream', () => {
    expect(detectSourceKind('https://host/movie.mp4')).toBe('direct');
    expect(detectSourceKind('http://host/live/stream')).toBe('direct');
  });

  it('rejects non-HTTP or missing links', () => {
    expect(detectSourceKind('not a url')).toBe('unknown');
    expect(detectSourceKind(null)).toBe('unknown');
    expect(detectSourceKind('')).toBe('unknown');
  });
});

describe('m3uToMediaEntries', () => {
  it('maps channel names to titles and keeps stream URLs', () => {
    const entries = m3uToMediaEntries(M3U);
    expect(entries).toEqual([
      { title: 'Big Buck Bunny', url: 'https://host/bbb.mp4' },
      { title: 'Tears of Steel', url: 'https://host/tos.mp4' },
    ]);
  });

  it('skips lines without a URL', () => {
    expect(m3uToMediaEntries('#EXTM3U\n#EXTINF:-1,No URL\n')).toEqual([]);
  });
});

describe('parseMediaManifest', () => {
  it('parses a JSON array of entries', () => {
    const entries = parseMediaManifest('[{"title":"A","url":"https://host/a.mp4"}]', 'json');
    expect(entries).toEqual([{ title: 'A', url: 'https://host/a.mp4' }]);
  });

  it('parses an object with a movies list', () => {
    const entries = parseMediaManifest('{"movies":[{"title":"A","url":"https://host/a.mp4"}]}', 'json');
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('A');
  });

  it('parses an M3U playlist', () => {
    expect(parseMediaManifest(M3U, 'm3u')).toHaveLength(2);
  });

  it('wraps a direct URL as one entry', () => {
    expect(parseMediaManifest('https://host/a.mp4', 'direct')).toEqual([
      { title: 'https://host/a.mp4', url: 'https://host/a.mp4' },
    ]);
  });

  it('gives a plain-English error for malformed JSON', () => {
    expect(() => parseMediaManifest('{not json', 'json')).toThrow('not a valid JSON library');
  });

  it('gives a plain-English error for the wrong JSON shape', () => {
    expect(() => parseMediaManifest('{"wrong":[]}', 'json')).toThrow('must be a list of movies');
    expect(() => parseMediaManifest('42', 'json')).toThrow('must be a list of movies');
  });

  it('gives a plain-English error for empty content', () => {
    expect(() => parseMediaManifest('   ', 'json')).toThrow('came back empty');
  });

  it('rejects an unknown source kind plainly', () => {
    expect(() => parseMediaManifest('x', 'unknown')).toThrow('does not look like a movie URL');
  });

  it('throws plain sentences, never a stack trace or a JSON.parse message', () => {
    try {
      parseMediaManifest('{bad', 'json');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e.message).not.toMatch(/SyntaxError|JSON\.parse|at Object/);
      expect(e.message).toMatch(/^[A-Z]/);
    }
  });
});
