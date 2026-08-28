# PRD — EN TV Player (Product Requirements Document)

> **Version:** 1.0 · **Date:** 2026-08-28
> **Rule:** Every feature must work with a Samsung TV remote alone.

---

## 1. Vision

Turn any Samsung Tizen TV (5.0+) into a private IPTV receiver. No server required — just point the app at a playlist and watch.

---

## 2. Target Users

| Persona | Device | Needs |
|---------|--------|-------|
| **TV Viewer** | Samsung TV, remote only | Instant boot-to-play, channel surfing, groups, favorites, working Back key |

---

## 3. Feature Set

### Shipped (v1.1.0)
| Feature | Status |
|---------|--------|
| HLS/DASH/MSS playback via Shaka | ✅ |
| DRM support (ClearKey, PlayReady) | ✅ |
| Playlist fetch (M3U/M3U8) | ✅ |
| Per-channel proxy toggle | ✅ |
| Number-pad tuning | ✅ |
| Virtualized channel list | ✅ |
| Settings page | ✅ |
| Full remote control (14 actions) | ✅ |

### Planned (v1.2.0)
- Boot into last-watched channel
- Favorites + recent channels
- Info bar with clock

### Future (v2.0.0)
- EPG support
- Audio/subtitle selection
- Parental lock

---

## 4. Core Workflows

1. **First run:** App opens → Settings → add playlist URL → Fetch → watch
2. **Surf:** Left opens sidebar → select channel → Back collapses
3. **Tune:** Type digits → OSD shows number → jump on timeout
4. **Fix:** Stream fails → Right menu → toggle proxy / reload

---

## 5. Non-Goals

- Cloud service, accounts, sync
- Recording, timeshift
- Non-Samsung platforms
- Full EPG

---

## 6. Success Criteria

1. Every remote key either performs an action or is intentionally ignored
2. 5,000-channel playlist scrolls without lag
3. App boots to video in ≤3s from cache
