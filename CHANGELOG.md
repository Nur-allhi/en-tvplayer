# Changelog

All notable changes to EN TV Player will be documented in this file.

## [1.6.0] - 2026-08-31

### Added
- Auto-refresh playlist on app launch — when enabled, playlist is downloaded and updated from source every time the app opens. Toggle available in Settings → Playback.

### Changed
- Boot flow now respects the `autoRefreshPlaylist` setting. When OFF, only cached channels from localStorage are loaded (no network fetch).

---

## [1.5.1] - 2026-08-31

### Fixed
- BUG-009: Fetch Active intermittent error during stream playback.
- Wrapped relay fallback in `fetchPlaylist` with its own try/catch so relay failures produce meaningful error messages instead of masking the real cause.
- Added double-click protection on Fetch Active button to prevent concurrent fetch operations.

---

## [1.5.0] - 2026-08-30

### Changed
- Updated app logo with new design.
- Updated Tizen community JSON for auto-release detection.

---

## [1.4.0] - 2026-08-28

### Added
- Channel name marquee scroll — long channel names auto-scroll horizontally in the sidebar so the full name is readable.
- Channel name text wrapped in inner span for proper marquee viewport clipping.

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
- Settings page now uses 100% width instead of fixed 1920px.

### Changed
- All CSS pixel values now use `calc(Xpx * var(--tv-scale))` for responsive sizing.
- JS detects screen resolution and sets `--tv-scale` CSS variable.

---

## [1.2.1] - 2026-08-28

### Fixed
- Back button now closes sidebars one by one (left, then right, then exit).
- Back on left sidebar previously showed group list instead of closing it.

---

## [1.2.0] - 2026-08-28

### Summary
- All critical bugs fixed (6 of 8 resolved)
- BUG-002 deferred (needs tests before file splitting)
- Ready for feature development

### Fixed
- BUG-001: Debug console.log statements
- BUG-003: Proxy debug logging
- BUG-004: Favorite TODO comment
- BUG-006: Tizen key registration warning
- BUG-007: Event listener cleanup
- BUG-008: Fresh install playlist fetch

### Closed
- BUG-005: innerHTML safety (not an issue — all content properly escaped)

---

## [1.1.3] - 2026-08-28

### Closed
- BUG-005: innerHTML safety (not an issue — all content properly escaped)

---

## [1.1.2] - 2026-08-28

### Fixed
- Added event listener cleanup to prevent duplicate listeners (BUG-007)
- Added Tizen key registration warning (BUG-006)
- Removed TODO comment from red key handler (BUG-004)

---

## [1.1.1] - 2026-08-28

### Fixed
- Playlist fetch fails on first add after fresh install (BUG-008)
- Removed `ui.stopInactivityTimer()` call before `ui.init()` was ready
- Added error logging in `showFirstLaunch()` callback (was silently swallowing errors)
- Removed debug console.log statements from production code (BUG-001)

---

## [1.1.0] - 2026-08-28

### Fixed
- Debug console.log statements removed from production code
- App version display updated (was showing 1.0.0)

### Changed
- Updated README with tested installation methods
- Added AI agent documentation (AGENTS.md, docs/*)
- Community package contribution

---

## [1.0.0] - 2026-08-24

### Added
- Initial release
- M3U/M3U8 playlist support
- DRM channel playback (ClearKey, PlayReady)
- Virtualized channel list for large playlists
- Per-channel proxy toggle
- Samsung Tizen remote control support
- Auto quality adjustment
