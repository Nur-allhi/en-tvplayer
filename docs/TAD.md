# TAD — EN TV Player (Technical Architecture Document)

> **Version:** 2.0 · **Date:** 2026-11-17
> **Hard rule:** Every code file ≤ 300 LOC, ≤ 15 exports, zero import cycles.
> **Verified:** 0 violations, 0 baseline exceptions.

---

## 1. System Components

| Component | Tech | Purpose |
|-----------|------|---------|
| `player/` | Vanilla JS SPA + Shaka Player 5, Vite | Playback + all TV UI |
| `tizen/` | Node + OpenSSL + Python | WGT packaging/signing |

No server. No database. Persistence = `localStorage` (`en_settings` key, schema v4).

---

## 2. Runtime Topology

```
TV (.wgt SPA) ── fetch ──► M3U8 playlists / JSON VOD manifests / CDNs
      │
      ├── direct ──► CDN upstream
      ├── proxied ──► user-configured proxy ──► CDN upstream
      └── VOD ──► same engine: lib/media-channel.js ──► player/load.js
```

Native AVPlay ignores CORS, so direct URLs the browser stack refuses still play
through `player/avplay.js`. Engine selection comes from one probe
(`capabilities.js`), never ad-hoc `typeof window.*` checks.

---

## 3. Data Models

### Player localStorage

| Key | Shape | Notes |
|-----|-------|-------|
| `en_settings` | v4 schema: playlists, channels, `movies`, `favorites`, `features`, toggles | Additive migration preserves all prior keys |
| `en_proxy_overrides` | `{ [channelUrl]: bool }` | Per-channel proxy toggle |

### Channel Object

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required |
| `url` | string | Required, http(s) |
| `channelNumber` | int | From M3U `tvg-chno` |
| `group` | string | From `group-title` |
| `useProxy` | bool | Default false |
| `drm` | object | ClearKey keys (VOD carries its own) |

### MediaEntry / Episode (VOD)

`lib/media-id.js` derives a stable FNV-1a slug from the normalised URL.
`state/vod.js` stores a library of `MediaEntry` objects; re-fetch merges by id
and preserves `resumeAt` per episode.

---

## 4. Module Map (all ≤ 300 LOC)

```
player/src/
├── main.js         4 LOC   entry point
├── app/           16 files boot, start, remote, shell, plugins, VOD store/resume
├── player/        15 files init, load, recovery, events, stream, state, deps hub
├── ui/            13 files core, sidebar, search, dialogs, osd, right-menu, library
├── settings/      12 files nav, select, render, playlists, playback, lifecycle
├── features/       8 files favorites, info-bar, proxy, VOD import, Tizen shims
├── lib/           19 files DOM-free helpers (m3u, url, drm, mime, media-id…)
├── state/          2 files reactive store + VOD library
├── styles/        10 CSS design tokens + focused sheets
└── root: avplay, capabilities, config, logic, main, remote, update, utils, xtream
```

Each layer has an `index.js` hub or a `deps.js` registry. Cross-slice calls go
through registered slots — no import cycles. Shared state is one object per
layer (`app/state.js`, `player/state.js`, `ui/state.js`, `settings/state.js`).

---

## 5. Build Pipeline

```
player/src/ ──Vite──► player/dist/ ──tizen/package.mjs──► beta/*.wgt
```

- Vite: IIFE format, es2015 target, single bundle (no runtime chunk loading)
- Tizen: ZIP + OpenSSL sign with the committed-authority key + cert fingerprint check
- `npm run tizen` aborts on a signing-key fingerprint mismatch — it never mints a key
