import { describe, it, expect } from 'vitest';
import { detectMimeType, sniffMimeFromBytes } from './mime.js';

// T-125: characterisation of the two DOM-free MIME decisions that used to live
// inside player.js. They are pure (URL/bytes in, MIME or null out), so they can
// be exercised here in the node env. Behaviour must stay byte-for-byte the same
// as the originals in player.js.

function bytesOf(text) {
  return new TextEncoder().encode(text);
}

describe('detectMimeType — URL pattern hints', () => {
  it('maps .ts to MPEG-TS', () => {
    expect(detectMimeType('https://cdn.example/live.ts')).toBe('video/mp2t');
  });

  it('maps .mp4 to MP4', () => {
    expect(detectMimeType('https://cdn.example/live.mp4')).toBe('video/mp4');
  });

  it('maps .mkv to Matroska', () => {
    expect(detectMimeType('https://cdn.example/live.mkv')).toBe('video/x-matroska');
  });

  it('maps .flv to Flash video', () => {
    expect(detectMimeType('https://cdn.example/live.flv')).toBe('video/x-flv');
  });

  it('leaves HLS manifests to Shaka (null)', () => {
    expect(detectMimeType('https://cdn.example/master.m3u8')).toBeNull();
  });

  it('leaves DASH manifests to Shaka (null)', () => {
    expect(detectMimeType('https://cdn.example/manifest.mpd')).toBeNull();
  });

  it('treats a trailing numeric path segment as MPEG-TS', () => {
    expect(detectMimeType('https://cdn.example/streams/12345')).toBe('video/mp2t');
  });

  it('ignores a query string when checking the path', () => {
    expect(detectMimeType('https://cdn.example/12345?token=abc')).toBe('video/mp2t');
  });

  it('does not mistake a query id for a numeric path segment', () => {
    expect(detectMimeType('https://cdn.example/stream?id=123')).toBeNull();
  });

  it('lowercases the path before matching extensions', () => {
    expect(detectMimeType('https://cdn.example/LIVE.TS')).toBe('video/mp2t');
  });

  it('matches an extension before query parameters', () => {
    expect(detectMimeType('https://cdn.example/v.mp4?token=abc')).toBe('video/mp4');
  });

  it('returns null for an unparseable URL', () => {
    expect(detectMimeType('not a url')).toBeNull();
  });
});

describe('sniffMimeFromBytes — first-bytes format decision', () => {
  it('detects MP4 from the ftyp box at offset 4', () => {
    const b = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(sniffMimeFromBytes(b)).toBe('video/mp4');
  });

  it('detects HLS from a leading #EXTM3U', () => {
    expect(sniffMimeFromBytes(bytesOf('#EXTM3U\n#EXT-X-VERSION:3\n'))).toBe('application/vnd.apple.mpegurl');
  });

  it('detects HLS from #EXT-X- anywhere in the head', () => {
    expect(sniffMimeFromBytes(bytesOf('junk\n#EXT-X-TARGETDURATION:4\n'))).toBe('application/vnd.apple.mpegurl');
  });

  it('detects HLS even with leading whitespace before #EXTM3U', () => {
    expect(sniffMimeFromBytes(bytesOf('  \n#EXTM3U\n'))).toBe('application/vnd.apple.mpegurl');
  });

  it('detects DASH from a leading <MPD', () => {
    expect(sniffMimeFromBytes(bytesOf('<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">'))).toBe('application/dash+xml');
  });

  it('detects DASH from an XML declaration followed by <MPD', () => {
    expect(sniffMimeFromBytes(bytesOf('<?xml version="1.0"?><MPD></MPD>'))).toBe('application/dash+xml');
  });

  it('detects MPEG-TS from repeating 0x47 sync bytes', () => {
    const b = new Uint8Array(600).fill(0);
    b[0] = b[188] = b[376] = b[564] = 0x47;
    expect(sniffMimeFromBytes(b)).toBe('video/mp2t');
  });

  it('allows the sync-byte run to start a few bytes in', () => {
    const b = new Uint8Array(600).fill(0);
    b[2] = b[190] = b[378] = b[566] = 0x47;
    expect(sniffMimeFromBytes(b)).toBe('video/mp2t');
  });

  it('returns null for fewer than eight bytes', () => {
    expect(sniffMimeFromBytes(new Uint8Array(7))).toBeNull();
  });

  it('returns null for a nullish input', () => {
    expect(sniffMimeFromBytes(null)).toBeNull();
  });

  it('returns null for bytes that match no known format', () => {
    expect(sniffMimeFromBytes(new Uint8Array(600).fill(0x1a))).toBeNull();
  });
});
