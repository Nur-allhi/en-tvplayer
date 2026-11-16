import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { fetchPlaylist, fetchPlaylistWithRetry } from './utils.js';

describe('fetchPlaylist / fetchPlaylistWithRetry', () => {
  let server;
  let base;
  let flakyHits = 0;

  beforeAll(
    () =>
      new Promise((resolve) => {
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
          } else if (req.url === '/json-object') {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ channels: [{ name: 'Wrapped', url: 'https://x.example.com/w' }] }));
          } else if (req.url === '/json-unexpected') {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ nope: true }));
          } else if (req.url === '/json-broken') {
            res.setHeader('content-type', 'application/json');
            res.end('{ not json');
          } else if (req.url === '/garbage') {
            res.setHeader('content-type', 'text/plain');
            res.end('this is not a playlist');
          } else {
            res.statusCode = 500;
            res.end('down');
          }
        });
        server.listen(0, '127.0.0.1', () => {
          base = 'http://127.0.0.1:' + server.address().port;
          resolve();
        });
      }),
  );

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it('fetches and parses an M3U playlist', async () => {
    const ch = await fetchPlaylist(base + '/list.m3u');
    expect(ch).toHaveLength(1);
    expect(ch[0].name).toBe('Srv');
  });

  it('passes JSON channel arrays through', async () => {
    expect(await fetchPlaylist(base + '/json')).toEqual([{ name: 'J', url: 'https://x.example.com/j' }]);
  });

  it('unwraps a { channels: [...] } JSON object', async () => {
    const ch = await fetchPlaylist(base + '/json-object');
    expect(ch[0].name).toBe('Wrapped');
  });

  it('rejects a JSON object with no channels array', async () => {
    await expect(fetchPlaylist(base + '/json-unexpected')).rejects.toThrow(/unexpected format/i);
  });

  it('rejects malformed JSON rather than returning nothing', async () => {
    await expect(fetchPlaylist(base + '/json-broken')).rejects.toThrow();
  });

  it('rejects a body that is neither JSON nor M3U', async () => {
    await expect(fetchPlaylist(base + '/garbage')).rejects.toThrow(/not supported/i);
  });

  it('reports a server error with its status code', async () => {
    await expect(fetchPlaylist(base + '/missing')).rejects.toThrow(/error 500/i);
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
