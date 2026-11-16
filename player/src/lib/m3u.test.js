import { describe, it, expect } from 'vitest';
import { processStreamUrl, parseStreamHeaders, parseM3u } from './m3u.js';

describe('processStreamUrl', () => {
  it('passes plain URLs through unchanged with no headers', () => {
    expect(processStreamUrl('https://x.example.com/a.m3u8')).toEqual({
      url: 'https://x.example.com/a.m3u8',
      extraHeaders: null,
    });
  });

  it('drops a trailing ? before appending edge params', () => {
    const r = processStreamUrl('https://x.example.com/a?|edge-token=T');
    expect(r.url).toBe('https://x.example.com/a?edge-token=T');
  });

  it('ignores DRM directives instead of turning them into headers', () => {
    const r = processStreamUrl('https://x.example.com/a.mpd|drmScheme=clearkey&drmLicense=AAAA:BBBB&User-Agent=U');
    expect(r.extraHeaders).toEqual({ 'user-agent': 'U' });
    expect(r.url).toBe('https://x.example.com/a.mpd');
  });

  it('appends edge params with & when the URL already has a query', () => {
    const r = processStreamUrl('https://x.example.com/a?x=1|edge-a=1&edge-b=2');
    expect(r.url).toBe('https://x.example.com/a?x=1&edge-a=1&edge-b=2');
  });

  it('prefers a literal pipe over a later %7C delimiter', () => {
    const r = processStreamUrl('https://x.example.com/a|User-Agent=U&b=%7Cc');
    expect(r.extraHeaders['user-agent']).toBe('U');
  });

  it('prefers %7C over a later literal pipe', () => {
    const r = processStreamUrl('https://x.example.com/a%7CUser-Agent=U');
    expect(r.url).toBe('https://x.example.com/a');
    expect(r.extraHeaders).toEqual({ 'user-agent': 'U' });
  });

  it('skips suffix parts without an = sign', () => {
    const r = processStreamUrl('https://x.example.com/a|junk&User-Agent=U');
    expect(r.extraHeaders).toEqual({ 'user-agent': 'U' });
  });

  it('lowercases header names', () => {
    const r = processStreamUrl('https://x.example.com/a|X-Custom-Header=V');
    expect(r.extraHeaders).toEqual({ 'x-custom-header': 'V' });
  });
});

describe('parseStreamHeaders', () => {
  it('returns empty headers and null UA for empty input', () => {
    expect(parseStreamHeaders('')).toEqual({ headers: {}, userAgent: null });
    expect(parseStreamHeaders(null)).toEqual({ headers: {}, userAgent: null });
  });

  it('keeps the first user-agent when several are present', () => {
    const { userAgent } = parseStreamHeaders('User-Agent=First&User-Agent=Second');
    expect(userAgent).toBe('First');
  });

  it('matches user-agent case-insensitively', () => {
    const { userAgent } = parseStreamHeaders('user-agent=Lower');
    expect(userAgent).toBe('Lower');
  });

  it('leaves malformed percent-encoding untouched instead of throwing', () => {
    const { headers } = parseStreamHeaders('Referer=%E0%A4%A');
    expect(headers['Referer']).toBe('%E0%A4%A');
  });

  it('trims surrounding whitespace from keys and values', () => {
    const { headers } = parseStreamHeaders('  Referer  =  https://s.example/  ');
    expect(headers['Referer']).toBe('https://s.example/');
  });

  it('skips parts with no = or an empty key', () => {
    expect(parseStreamHeaders('junk&=value').headers).toEqual({});
  });
});

describe('parseM3u — channel numbering', () => {
  it('accepts the channel-number alias', () => {
    const ch = parseM3u('#EXTM3U\n#EXTINF:-1 channel-number="42",Alias\nhttps://x.example.com/a\n');
    expect(ch[0].channelNumber).toBe(42);
  });

  it('prefers tvg-chno over channel-number', () => {
    const ch = parseM3u('#EXTM3U\n#EXTINF:-1 channel-number="9" tvg-chno="5",Both\nhttps://x.example.com/a\n');
    expect(ch[0].channelNumber).toBe(5);
  });

  it('falls back to the running index for non-numeric numbers', () => {
    const ch = parseM3u('#EXTM3U\n#EXTINF:-1 tvg-chno="abc",Bad\nhttps://x.example.com/a\n');
    expect(ch[0].channelNumber).toBe(1);
  });

  it('falls back to the running index for zero and negatives', () => {
    const ch = parseM3u(
      '#EXTM3U\n#EXTINF:-1 tvg-chno="0",Zero\nhttps://x.example.com/a\n' +
        '#EXTINF:-1 tvg-chno="-3",Neg\nhttps://x.example.com/b\n',
    );
    expect(ch[0].channelNumber).toBe(1);
    expect(ch[1].channelNumber).toBe(2);
  });
});

describe('parseM3u — structure', () => {
  it('names an entry with no comma', () => {
    const ch = parseM3u('#EXTM3U\n#EXTINF:-1\nhttps://x.example.com/a\n');
    expect(ch[0].name).toBe('Channel 1');
  });

  it('skips #EXTSYS lines but keeps scanning for the URL', () => {
    const ch = parseM3u('#EXTM3U\n#EXTINF:-1,Sys\n#EXTSYS:something\nhttps://x.example.com/a\n');
    expect(ch).toHaveLength(1);
    expect(ch[0].url).toBe('https://x.example.com/a');
  });

  it('ignores a malformed EXTHTTP payload without losing the channel', () => {
    const ch = parseM3u('#EXTM3U\n#EXTINF:-1,Bad\n#EXTHTTP:{not json}\nhttps://x.example.com/a\n');
    expect(ch).toHaveLength(1);
    expect(ch[0].customHeaders).toBeNull();
  });

  it('stringifies non-string EXTHTTP values', () => {
    const ch = parseM3u('#EXTM3U\n#EXTINF:-1,Num\n#EXTHTTP:{"X-Count":5}\nhttps://x.example.com/a\n');
    expect(ch[0].customHeaders['X-Count']).toBe('5');
  });

  it('lets a later stream_headers KODIPROP merge over an earlier EXTHTTP', () => {
    const ch = parseM3u(
      '#EXTM3U\n#EXTINF:-1,Merge\n#EXTHTTP:{"A":"1"}\n' +
        '#KODIPROP:inputstream.adaptive.stream_headers=B=2\nhttps://x.example.com/a\n',
    );
    expect(ch[0].customHeaders).toEqual({ A: '1', B: '2' });
  });

  it('tolerates CRLF line endings', () => {
    const ch = parseM3u('#EXTM3U\r\n#EXTINF:-1 group-title="G",Crlf\r\nhttps://x.example.com/a\r\n');
    expect(ch).toHaveLength(1);
    expect(ch[0]).toMatchObject({ name: 'Crlf', group: 'G' });
    expect(ch[0].url).toBe('https://x.example.com/a');
  });

  it('ignores an EXTINF whose URL line is itself a directive', () => {
    expect(parseM3u('#EXTM3U\n#EXTINF:-1,NoUrl\n#EXTVLCOPT:x=y\n')).toEqual([]);
  });
});
