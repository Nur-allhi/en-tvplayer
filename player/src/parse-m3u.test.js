import { describe, it, expect } from 'vitest';
import { parseM3u } from './utils.js';

const M3U_BASIC = `#EXTM3U
#EXTINF:-1 tvg-chno="7" group-title="News",BBC News
https://cdn.example.com/bbc.m3u8
#EXTINF:-1 group-title="Sports",ESPN
https://cdn.example.com/espn.m3u8
`;

describe('parseM3u', () => {
  it('parses names, groups and playlist channel numbers', () => {
    const ch = parseM3u(M3U_BASIC);
    expect(ch).toHaveLength(2);
    expect(ch[0]).toMatchObject({ name: 'BBC News', group: 'News', channelNumber: 7 });
    expect(ch[0].url).toBe('https://cdn.example.com/bbc.m3u8');
    expect(ch[1]).toMatchObject({ name: 'ESPN', group: 'Sports', channelNumber: 2 });
  });

  it('falls back to index numbers and null group', () => {
    const ch = parseM3u('#EXTM3U\n#EXTINF:-1,Plain\nhttps://x.example.com/a.ts\n');
    expect(ch[0]).toMatchObject({ name: 'Plain', group: null, channelNumber: 1 });
  });

  it('keeps commas inside quoted names', () => {
    const ch = parseM3u('#EXTM3U\n#EXTINF:-1 group-title="A",Show, With, Commas\nhttps://x.example.com/a\n');
    expect(ch[0].name).toBe('Show, With, Commas');
  });

  it('parses KODIPROP stream_headers into headers + userAgent', () => {
    const m3u = `#EXTM3U
#EXTINF:-1,Auth Channel
#KODIPROP:inputstream.adaptive.stream_headers=User-Agent=CustomUA&Referer=https%3A%2F%2Fsite.example%2F
https://x.example.com/live
`;
    const ch = parseM3u(m3u);
    expect(ch[0].userAgent).toBe('CustomUA');
    expect(ch[0].customHeaders['Referer']).toBe('https://site.example/');
  });

  it('parses a single KID:KEY license_key', () => {
    const m3u = `#EXTM3U
#EXTINF:-1,DRM One
#KODIPROP:inputstream.adaptive.license_key=abcdef1234567890:1234567890abcdef
https://x.example.com/cenc.mpd
`;
    const ch = parseM3u(m3u);
    expect(ch[0].drm.clearKeys).toEqual({ abcdef1234567890: '1234567890abcdef' });
  });

  it('parses a multi-key license_key dict', () => {
    const m3u = `#EXTM3U
#EXTINF:-1,DRM Multi
#KODIPROP:inputstream.adaptive.license_key={"abcdef1234567890":"1234567890abcdef","0011223344556677":"8899aabbccddeeff"}
https://x.example.com/cenc.mpd
`;
    const ch = parseM3u(m3u);
    expect(Object.keys(ch[0].drm.clearKeys)).toHaveLength(2);
    expect(ch[0].drm.keyId).toBe('abcdef1234567890');
  });

  it('promotes Cookie auth tokens to authQuery', () => {
    const m3u = `#EXTM3U
#EXTINF:-1,Token Channel
#KODIPROP:inputstream.adaptive.stream_headers=Cookie=__hdnea__%3DSTV_TOKEN123
https://x.example.com/live.m3u8
`;
    const ch = parseM3u(m3u);
    expect(ch[0].authQuery).toBe('__hdnea__=STV_TOKEN123');
  });

  it('splits Kodi pipe suffix into headers, keeps edge- params on the URL', () => {
    const m3u = `#EXTM3U
#EXTINF:-1,Pipe
https://x.example.com/live|User-Agent=UA1&edge-token=ABC
`;
    const ch = parseM3u(m3u);
    expect(ch[0].url).toBe('https://x.example.com/live?edge-token=ABC');
    expect(ch[0].customHeaders['user-agent']).toBe('UA1');
  });

  it('reads drmLicense tokens from the stream URL', () => {
    const ch = parseM3u('#EXTM3U\n#EXTINF:-1,Tok\nhttps://x.example.com/a.mpd?drmLicense=abcdef1234567890:1234567890abcdef\n');
    expect(ch[0].drm.clearKeys).toEqual({ abcdef1234567890: '1234567890abcdef' });
  });

  it('parses EXTHTTP JSON headers and EXTVLCOPT user agent', () => {
    const m3u = `#EXTM3U
#EXTINF:-1,Http
#EXTHTTP:{"Authorization":"Bearer XYZ"}
#EXTVLCOPT:http-user-agent=VlcUA
https://x.example.com/a
`;
    const ch = parseM3u(m3u);
    expect(ch[0].customHeaders['Authorization']).toBe('Bearer XYZ');
    expect(ch[0].userAgent).toBe('VlcUA');
  });

  it('ignores comment lines and entries without URLs', () => {
    const ch = parseM3u('#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:-1,No URL\n#EXTINF:-1,Has URL\nhttps://x.example.com/a\n');
    expect(ch).toHaveLength(1);
    expect(ch[0].name).toBe('Has URL');
  });

  it('returns [] for garbage input', () => {
    expect(parseM3u('not a playlist')).toEqual([]);
    expect(parseM3u('')).toEqual([]);
  });
});
