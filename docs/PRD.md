# PRD — EN TV Player (Product Requirements Document)

> **Version:** 2.0 · **Date:** 2026-11-17
> **Rule:** Every feature must work with a Samsung TV remote alone.

---

## 1. Vision

Turn any Samsung Tizen TV (5.0+) into a private IPTV receiver. No server required — point the app at a playlist and watch. v4 adds a movies/series library using the same engine, with no second player.

---

## 2. Target Users

| Persona | Device | Needs |
|---------|--------|-------|
| **TV Viewer** | Samsung TV, remote only | Instant boot-to-play, channel surfing, groups, favorites, working Back key |
| **VOD Viewer** | Same TV | Browse movies/series, resume where left off, audio/subtitle/quality pickers |

---

## 3. Feature Set

### Shipped

| Feature | Since |
|---------|-------|
| HLS/DASH/MSS playback via Shaka | v1.1 |
| DRM (ClearKey, PlayReady) | v1.1 |
| Playlist fetch (M3U/M3U8) + Xtream | v1.1 |
| Per-channel proxy toggle | v1.1 |
| Number-pad tuning, virtualized list (5,000+) | v1.1 |
| Full remote control (14 actions) | v1.1 |
| Boot into last channel + group | v3.1 |
| Capability probe as single platform truth | v4.0 |
| Pure recovery decisions, bounded retry budgets | v4.0 |
| Modular app/player/ui/settings layers | v4.0 |
| Favorites, info bar with clock | v4.0 |
| In-app log ring + copy diagnostics | v4.0 |
| Tizen 5.0 compatibility shims (guarded) | v4.0 |
| Engine fallback notice (never a blank screen) | v4.0 |
| **Movies + series library (VOD)** | **v4.0** |
| - Direct URL, M3U, or user JSON manifest | |
| - Stable ids, re-fetch preserves resume position | |
| - Series season/episode browsing, Resume row | |
| - Audio, subtitle and quality pickers | |
| - Settings schema v4 additive migration | |

### Future

- Full EPG
- Parental lock
- Additional Tizen models verified per-device

---

## 4. Core Workflows

1. **First run:** Add your source → M3U URL or Xtream login → Fetch → watch
2. **Surf:** Left opens sidebar → select channel → Back collapses
3. **Tune:** Digits → OSD → jump on timeout
4. **Fix:** Stream fails → Right menu → proxy / reload / native fallback
5. **VOD:** Sidebar → 🎬 Library → Movies or Series → OK for detail → OK to play
6. **Resume:** Detail card shows "Resume at m:ss" → OK restores position (±5 s)

---

## 5. Non-Goals

- Cloud service, accounts, sync
- Recording, timeshift
- Non-Samsung platforms
- Full EPG
- **Site scraping for VOD** — sources are user-supplied direct URLs, M3U or JSON only; arbitrary web pages are not CORS-readable from a TV
- VOD transcoding, hosting, or store DRM

---

## 6. Success Criteria

1. Every remote key either performs an action or is intentionally ignored
2. 5,000-channel playlist scrolls without lag
3. App boots to video in ≤3 s from cache
4. A movie plays end-to-end from a direct URL; a series browses to an episode and plays
5. Resume position restored within ±5 s
6. Every code file ≤ 300 LOC (zero exceptions as of v4.0)
