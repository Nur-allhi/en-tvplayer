import { describe, it, expect } from 'vitest';
import { mediaToChannel } from './media-channel.js';

// T-185: a VOD entry is adapted into the same channel shape the existing
// player already loads. Pure, so the mapping is testable without a TV.

const movie = {
  id: 'm-1',
  title: 'A Movie',
  url: 'https://media.example/movie.m3u8',
  type: 'movie',
  drm: { clearKeys: { kid: 'key' } },
  customHeaders: { Referer: 'https://media.example/' },
  userAgent: 'TV/1.0',
  authQuery: 'token=abc',
};

describe('mediaToChannel', () => {
  it('maps the title and url', () => {
    const channel = mediaToChannel(movie);
    expect(channel.name).toBe('A Movie');
    expect(channel.url).toBe(movie.url);
  });

  it('carries DRM through to the player', () => {
    expect(mediaToChannel(movie).drm).toEqual(movie.drm);
  });

  it('carries request headers and user agent', () => {
    const channel = mediaToChannel(movie);
    expect(channel.customHeaders).toEqual(movie.customHeaders);
    expect(channel.userAgent).toBe('TV/1.0');
  });

  it('carries the auth query', () => {
    expect(mediaToChannel(movie).authQuery).toBe('token=abc');
  });

  it('uses the episode title and url for an episode', () => {
    const episode = {
      id: 'e-1',
      title: 'S1E1 Pilot',
      url: 'https://media.example/e1.m3u8',
      season: 1,
      number: 1,
    };
    const channel = mediaToChannel(movie, episode);
    expect(channel.name).toBe('A Movie — S1E1 Pilot');
    expect(channel.url).toBe(episode.url);
  });

  it('falls back to the id when the title is missing', () => {
    expect(mediaToChannel({ ...movie, title: '' }).name).toBe('m-1');
  });

  it('does not attach empty optional fields', () => {
    const channel = mediaToChannel({ id: 'x', title: 'X', url: 'https://x.example/a.m3u8' });
    expect(channel.drm).toBeUndefined();
    expect(channel.customHeaders).toBeUndefined();
    expect(channel.userAgent).toBeUndefined();
  });

  it('ignores a null episode', () => {
    expect(mediaToChannel(movie, null).url).toBe(movie.url);
  });
});
