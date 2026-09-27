import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import {
  processStreamUrl,
  extractAuthQuery,
  withAuthQuery,
  parseStreamHeaders,
  parseLicenseKeyValue,
  redactUrl,
  fetchPlaylist,
  fetchPlaylistWithRetry,
} from './utils.js';

describe('processStreamUrl', () => {
  it('passes plain URLs through', () => {
    expect(processStreamUrl('https://x.example.com/a.m3u8'))
      .toEqual({ url: 'https://x.example.com/a.m3u8', extraHeaders: null });
  });

  it('splits pipe headers from the base URL', () => {
    const r = processStreamUrl('https://x.example.com/a|Referer=https://s.example/&User-Agent=U');
    expect(r.url).toBe('https://x.example.com/a');
    expect(r.extraHeaders).toEqual({ referer: 'https://s.example/', 'user-agent': 'U' });
  });

  it('keeps edge- params on the URL', () => {
    const r = processStreamUrl('https://x.example.com/a?x=1|edge-token=T&X-Foo=bar');
    expect(r.url).toBe('https://x.example.com/a?x=1&edge-token=T');
    expect(r.extraHeaders).toEqual({ 'x-foo': 'bar' });
  });

  it('supports URL-encoded pipe delimiters', () => {
    const r = processStreamUrl('https://x.example.com/a%7CUser-Agent=U');
    expect(r.url).toBe('https://x.example.com/a');
    expect(r.extraHeaders).toEqual({ 'user-agent': 'U' });
  });
});

describe('extractAuthQuery', () => {
  it('promotes known token cookies', () => {
    expect(extractAuthQuery({ Cookie: 'sess=abc; __hdnea__=TOK123' })).toBe('__hdnea__=TOK123');
  });

  it('ignores unknown cookies and empty input', () => {
    expect(extractAuthQuery({ Cookie: 'sess=abc' })).toBeNull();
    expect(extractAuthQuery(null)).toBeNull();
    expect(extractAuthQuery({})).toBeNull();
  });
});

describe('withAuthQuery', () => {
  it('appends missing params and skips present ones', () => {
    expect(withAuthQuery('https://h.example.com/a', '__hdnea__=T')).toBe('https://h.example.com/a?__hdnea__=T');
    expect(withAuthQuery('https://h.example.com/a?__hdnea__=T', '__hdnea__=T')).toBe('https://h.example.com/a?__hdnea__=T');
  });

  it('leaves non-network URIs (e.g. data: licenses) untouched', () => {
    const dataUri = 'data:text/plain;base64,QUJD';
    expect(withAuthQuery(dataUri, '__hdnea__=T')).toBe(dataUri);
  });
});

describe('parseStreamHeaders', () => {
  it('decodes URL-encoded values and picks out the UA', () => {
    const { headers, userAgent } = parseStreamHeaders('User-Agent=My%20UA&Referer=https%3A%2F%2Fs.example%2F');
    expect(userAgent).toBe('My UA');
    expect(headers['Referer']).toBe('https://s.example/');
  });
});

describe('parseLicenseKeyValue', () => {
  it('parses single KID:KEY pairs', () => {
    expect(parseLicenseKeyValue('abcdef1234567890:1234567890abcdef')).toMatchObject({ keyId: 'abcdef1234567890' });
  });

  it('returns null for license-server URLs and garbage', () => {
    expect(parseLicenseKeyValue('https://lic.example.com/key')).toBeNull();
    expect(parseLicenseKeyValue('nope')).toBeNull();
  });
});

describe('redactUrl', () => {
  it('strips query strings and fragments from stream URLs', () => {
    expect(redactUrl('https://cdn.example.com/live/bbc?token=SECRET')).toBe('https://cdn.example.com/live/bbc');
    expect(redactUrl('https://h.example.com/a.ts?__hdnea__=ABC#frag')).toBe('https://h.example.com/a.ts');
  });

  it('leaves clean URLs, other schemes and non-strings alone', () => {
    expect(redactUrl('https://h.example.com/a.ts')).toBe('https://h.example.com/a.ts');
    expect(redactUrl('data:text/plain,abc?def')).toBe('data:text/plain,abc?def');
    expect(redactUrl(null)).toBeNull();
  });
});

describe('fetchPlaylist / fetchPlaylistWithRetry', () => {
  let server;
  let base;
  let flakyHits = 0;

  beforeAll(() => new Promise((resolve) => {
    server = http.createServer((req, res) => {
      if (req.url === '/list.m3u') {
        res.setHeader('content-type', 'application/x-mpegURL');
        res.end('#EXTM3U\n#EXTINF:-1,Srv\nhttps://x.example.com/a\n');
      } else if (req.url === '/flaky.m3u') {
        flakyHits++;
        if (flakyHits === 1) {
          res.statusCode = 500;
          res.end('boom');
        } else {
          res.end('#EXTM3U\n#EXTINF:-1,Flaky\nhttps://x.example.com/f\n');
        }
      } else if (req.url === '/json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify([{ name: 'J', url: 'https://x.example.com/j' }]));
      } else {
        res.statusCode = 500;
        res.end('down');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      base = 'http://127.0.0.1:' + server.address().port;
      resolve();
    });
  }));

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('fetches and parses an M3U playlist', async () => {
    const ch = await fetchPlaylist(base + '/list.m3u');
    expect(ch).toHaveLength(1);
    expect(ch[0].name).toBe('Srv');
  });

  it('passes JSON channel arrays through', async () => {
    expect(await fetchPlaylist(base + '/json')).toEqual([{ name: 'J', url: 'https://x.example.com/j' }]);
  });

  it('retries a transient 500 then succeeds', async () => {
    const ch = await fetchPlaylistWithRetry({ url: base + '/flaky.m3u' }, 1);
    expect(ch[0].name).toBe('Flaky');
    expect(flakyHits).toBe(2);
  });

  it('throws after exhausting retries', async () => {
    await expect(fetchPlaylistWithRetry({ url: base + '/missing' }, 1)).rejects.toThrow();
  });
});
