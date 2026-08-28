# TAD — EN TV Player (Technical Architecture Document)

> **Version:** 1.0 · **Date:** 2026-08-28
> **Hard rule:** Every code file ≤ 300 LOC.

---

## 1. System Components

| Component | Tech | Purpose |
|-----------|------|---------|
| `player/` | Vanilla JS SPA + Shaka Player 5, Vite | Playback + all TV UI |
| `tizen/` | Node + OpenSSL + Python | WGT packaging/signing |

No server. No database. Persistence = `localStorage`.

---

## 2. Runtime Topology

```
TV (.wgt SPA) ── fetch ──► M3U8 Playlist URLs / CDNs
      │
      ├── direct ──► CDN upstream
      └── proxied ──► User-configured proxy ──► CDN upstream
```

---

## 3. Data Models

### Player localStorage

| Key | Shape | Notes |
|-----|-------|-------|
| `en_settings` | `{ playlists, activePlaylistIndex, proxyUrl, channels, channelsFetched, autoQuality }` | Main settings |
| `en_proxy_overrides` | `{ [channelUrl]: bool }` | Per-channel proxy toggle |

### Channel Object

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required |
| `url` | string | Required, http(s) |
| `channelNumber` | int | From M3U `tvg-chno` |
| `group` | string | From `group-title` |
| `useProxy` | bool | Default false |
| `drm` | object | ClearKey hex pair |

---

## 4. Module Map (≤ 300 LOC each)

| Module | Purpose | Max LOC |
|--------|---------|---------|
| `main.js` | App entry, state routing | 300 |
| `player.js` | Shaka Player wrapper | 300 |
| `ui.js` | Channel list, sidebar, overlays | 300 |
| `settings.js` | Settings page | 300 |
| `remote.js` | Remote control handler | 250 |
| `config.js` | localStorage CRUD | 150 |
| `utils.js` | Shared utilities | 200 |

---

## 5. Build Pipeline

```
player/src/ ──Vite──► player/dist/ ──tizen/package.mjs──► releases/*.wgt
```

- Vite: IIFE format, es2015 target, minified
- Tizen: ZIP + OpenSSL sign + package
