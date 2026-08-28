# Changelog

All notable changes to EN TV Player will be documented in this file.

## [Unreleased]

### Fixed
- Playlist fetch fails on first add after fresh install (BUG-008)
- Removed `ui.stopInactivityTimer()` call before `ui.init()` was ready
- Added error logging in `showFirstLaunch()` callback (was silently swallowing errors)

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
