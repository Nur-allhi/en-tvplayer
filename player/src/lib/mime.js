// Pure MIME/format decisions extracted from player.js (T-125). No DOM, no
// module state — inputs in, a MIME string or null out. The fetch/AbortController
// that gathers the probe bytes stays in player.js; only the decision lives here.

// Detect MIME type from URL pattern for direct stream URLs.
// IPTV playlists often contain raw .ts or .mp4 URLs without manifest wrappers.
// Shaka Player needs a MIME type hint to play these correctly on Samsung Tizen.
export function detectMimeType(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (path.endsWith('.m3u8')) return null; // HLS — Shaka detects automatically
    if (path.endsWith('.mpd')) return null; // DASH — Shaka detects automatically
    if (path.endsWith('.ts')) return 'video/mp2t';
    if (path.endsWith('.mp4')) return 'video/mp4';
    if (path.endsWith('.mkv')) return 'video/x-matroska';
    if (path.endsWith('.flv')) return 'video/x-flv';
    // Direct numeric or query-only paths (e.g. /1234 or /stream?id=123)
    // are almost always MPEG-TS streams in IPTV playlists.
    const segs = path.split('/').filter(Boolean);
    if (segs.length > 0 && /^\d+$/.test(segs[segs.length - 1])) {
      return 'video/mp2t';
    }
  } catch {}
  return null; // let Shaka auto-detect
}

// BUG-014: decide the MIME from the first bytes of a stream whose URL and
// Content-Type gave Shaka no clue (error 4000). `bytes` is a Uint8Array of the
// first chunk; this returns null when the format cannot be determined.
export function sniffMimeFromBytes(bytes) {
  if (!bytes || bytes.length < 8) return null;

  // MP4: ftyp box at offset 4.
  const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (box === 'ftyp') return 'video/mp4';

  // Text-based manifests: HLS (#EXTM3U / #EXT-X-...) and DASH (<MPD).
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 8192)));
  const trimmed = head.trimStart();
  if (trimmed.startsWith('#EXTM3U') || head.includes('#EXT-X-')) {
    return 'application/vnd.apple.mpegurl'; // force Shaka's HLS parser
  }
  if (trimmed.startsWith('<MPD') || (trimmed.startsWith('<?xml') && head.includes('<MPD'))) {
    return 'application/dash+xml'; // force Shaka's DASH parser
  }

  // MPEG-TS: sync byte 0x47 repeating every 188 bytes.
  for (let start = 0; start < 4 && start + 564 < bytes.length; start++) {
    if (
      bytes[start] === 0x47 &&
      bytes[start + 188] === 0x47 &&
      bytes[start + 376] === 0x47 &&
      bytes[start + 564] === 0x47
    ) {
      return 'video/mp2t';
    }
  }
  return null;
}
