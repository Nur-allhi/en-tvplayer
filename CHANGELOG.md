# Changelog

All notable changes to EN TV Player will be documented in this file.

## [2.1.1] - 2026-09-11

### Added
- Display toggles in Settings → Playback: App logo (top-left) and Quality badge (top-right) can be shown or hidden.

---

## [2.1.0] - 2026-09-10

### Added
- Kodi-style `#KODIPROP:inputstream.adaptive.stream_headers` support — per-channel custom headers (User-Agent, Referer, Authorization, X-*) sent with every stream request.
- Multi-key ClearKey DRM via `#KODIPROP:inputstream.adaptive.license_key` dict (`{KID:KEY}` unquoted and `{"KID":"KEY"}` JSON); single `KID:KEY` still works.

### Fixed
- Update checker never ran (defined but never invoked at boot) — now asks once and checks in background when opted in.

---

## [2.0.0] - 2026-09-08

### Added
- Slide-in player watermark (logo + EN IPTV) that docks once the sidebar hides.
- Stream type in the resolution badge (e.g. FHD • 6.2 Mbps • M3U8).
- Brand watermark backdrop — no blank screen on tune, errors, or empty states.

### Changed
- Tune sequence reworked: loading veil with spinner + centered channel name, name holds through buffering, status and errors share the bottom pill.
- Unified rounded card rows, white radius-following focus rings, and smooth focus scrolling across channel list, right menu, and Settings.
- Settings streamlined: Connection section removed, page title removed, About restructured into rows.
- Splash staged: icon, typed EN IPTV title, tagline, spinner; holds past the tagline when idle.

### Removed
- Proxy system removed (app, Settings, dev server) — the TV plays streams direct.

### Fixed
- Playing row stays marked across sidebar reopen, group changes, and refresh.
- Deep channel lists no longer jump to top (virtual scroll spacers).
- Transient upstream blips no longer restart healthy playback.
- Missing proxy destination no longer bypasses silently (legacy, pre-removal).
- Tizen fixes: flex-gap spacing, paint-before-teardown veil, video-plane layering, LAN-IP DRM guidance.

---

## [1.10.1] - 2026-09-07

### Fixed
- BUG-018: Fresh install with no playlist — backing out of Settings landed on a dead page. The player shell now initializes with zero channels and a "No channels" empty state, so sidebars and Settings stay reachable.
- BUG-019: Resolution badge lied (froze on the optimistic first pick). It now follows live ABR switches; Auto mode opens low for a fast first frame and climbs correctly (inverted upgrade/downgrade targets fixed).
- BUG-020: Interlaced (576i/1080i) channels played black with no error. Zero-frame watchdog migrates those to native AVPlay with the same proxy/headers.
- BUG-021: Relay rate-limit storms (403/401, "nothing plays"). Polite retries with cool-downs, fresh-token recovery for mid-playback 401, auto-advance on dead links, activity-aware load timeout.

### Changed
- Channel loading is staged: spinner, then first frame, then buffering percent — one indicator at a time.
- Buffering shows a stacked channel-name toast plus an enlarged pill with time-aware hints.
- Boot intro: logo holds, then flies toward the viewer before revealing the player.

---

## [1.10.0] - 2026-09-05

### Added
- Opt-in update checker — first-launch consent (default off), background check for new releases, gentle notice via Settings badge and What's New banner. Toggle in Settings → Playback.
- Download stats (`docs/STATS.md`) and Telegram contact (@nureallhiii) in README.

---

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
