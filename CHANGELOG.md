# Changelog

All notable changes to EN TV Player will be documented in this file.

## [1.9.0] - 2026-09-05

### Fixed
- BUG-017: Tokenized live playlists (e.g. kliv) now play — channels no longer die after the first frame with "Connection lost" / Shaka 4032.
  - Stale-segment transmux failures and disabled-variant states are retried with a fresh playlist fetch (new token).
  - Access-denied (403/401) at load is retried twice with a fresh token before showing an error.
  - Accurate messages for stream-breakup errors; removed invalid Shaka config keys; fixed format-probe lookup on retry.

---

## [1.8.0] - 2026-09-05

### Fixed
- BUG-011: Remote OK on Settings now saves — playlist renames persist and quality toggles no longer revert.
- BUG-012: Enter inside Settings text fields now works on TV — Proxy URL saves, playlist name/URL forms submit and advance correctly.
- BUG-013: Channels that crashed inside Shaka on HLS date-time sync are retried once in compatibility mode instead of showing a cryptic engine error.
- BUG-014: Channels Shaka could not identify (extension-less/tokenized links) are now probed from their first bytes and retried with the correct format; error codes corrected to Shaka 5.x (including real 403 detection).
- BUG-015: "Try enabling Proxy" hint now shows bottom-center under the error message.
- BUG-016: Settings back button no longer sticks to the "Settings" title.

---

## [1.7.0] - 2026-09-03

### Fixed
- BUG-010: Some IPTV channels show black screen with no error (critical).
  - Added MIME type detection for direct TS/MP4 stream URLs — Shaka Player now correctly identifies raw IPTV stream formats.
  - Changed `ignoreManifestProgramDateTime` from `true` to `false` — fixes HLS streams that need date-time sync.
  - Enabled `forceTransmuxTS` — raw TS streams are now properly converted for browser playback.
  - Added `segmentFormat: 'mpegts'` for HLS — fixes IPTV servers that serve MPEG-TS segments.
  - Added video element `error`, `stalled`, and `waiting` event listeners — browser-level playback failures are now caught and shown to the user.
  - Reduced load timeout from 30s to 15s with visible error message instead of silent retry.
  - Added reconnect limit (3 attempts) — shows clear error after exhausting retries instead of looping forever.

### Changed
- All error messages rewritten in plain non-technical English — users can now understand and report issues clearly.
  - Removed HTTP codes (403, 404), codec names, DRM terms, and manifest references from user-facing messages.
  - Added actionable hints (e.g., "Try turning on Proxy", "Check your internet connection").
- Improved Shaka player config for Samsung Tizen IPTV compatibility (buffering, prefetch, bufferBehind).

---

## [1.6.0] - 2026-08-31

### Added
- Boot splash loading animation with logo entrance, typewriter tagline, and spinner.
- App version displayed on boot splash screen.
- What's New modal — shows once after update with all recent changes.
- Auto-refresh playlist on app launch (toggle in Settings → Playback).

### Fixed
- BUG-009: Fetch Active intermittent error during stream playback.
- Relay fallback now shows meaningful error messages.
- Fetch Active button disables during loading to prevent double-click.

---

## [1.5.0] - 2026-08-30

### Changed
- Updated app logo with new design.
- Updated Tizen community JSON for auto-release detection.

---

## [1.4.0] - 2026-08-28

### Added
- Channel name marquee scroll — long channel names auto-scroll horizontally in the sidebar.

### Fixed
- Sequential channel numbers in sidebar, channels sorted alphabetically within groups.
- Sidebar scroll not showing focused item at bottom of list.
- Instant channel switch on Up/Down, toast auto-hides after 0.5s.
- Consistent Left/Right sidebar navigation.

---

## [1.3.0] - 2026-08-28

### Added
- Responsive TV scaling — UI components scale proportionally based on screen size.
- Minimum 1.35x scale for comfortable couch viewing on 1080p TVs.

---

## [1.2.0] - 2026-08-28

### Fixed
- BUG-001: Debug console.log statements removed from production code.
- BUG-004: Favorite TODO comment removed.
- BUG-006: Tizen key registration warning added.
- BUG-007: Event listener cleanup added.
- BUG-008: Fresh install playlist fetch fixed.

---

## [1.1.0] - 2026-08-28

### Fixed
- BUG-001: Debug console.log statements removed from production code.
- App version display updated (was showing 1.0.0).
- Playlist fetch fails on first add after fresh install (BUG-008).

### Changed
- Updated README with tested installation methods.
- Added AI agent documentation (AGENTS.md, docs/*).
- Community package contribution.

---

## [1.0.0] - 2026-08-24

### Added
- Initial release — M3U/M3U8 playlist support, DRM channel playback, virtualized channel list, per-channel proxy toggle, Samsung Tizen remote control support, auto quality adjustment.
