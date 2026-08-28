# AGENTS.md — EN TV Player

> **Check this file at the start of every conversation.** Update it whenever new conventions or files are introduced.

## 1. Project Overview

**EN TV Player** is a standalone Samsung Tizen TV IPTV player. No server required — fetches M3U8 playlists directly.

**Key principle:** Everything must work with a Samsung TV remote alone (5-way pad, number pad, color keys, Back).

## 2. Available Skills

| Skill | Purpose in this project |
|---|---|
| `senior-frontend` | Player SPA implementation, remote input, playback engine |
| `frontend-design` | Visual system, CSS, theming |
| `ui-ux-pro-max` | 10-foot UX rules, interaction design, TV conventions |
| `code-reviewer` | Pre-merge verification: security, code quality, spec-compliance |
| `gitnexus` | Git operations per `docs/REPO_RULES.md` |

## 3. Project Structure

```
en-tvplayer/
├── AGENTS.md            ← this file
├── player/              Shaka SPA (TV app)
│   ├── src/
│   │   ├── main.js      App entry point
│   │   ├── player.js    Shaka Player wrapper
│   │   ├── ui.js        Channel list + sidebar
│   │   ├── settings.js  Settings page
│   │   ├── remote.js    Remote control handler
│   │   ├── config.js    localStorage settings
│   │   └── utils.js     Shared utilities
│   ├── public/          Static assets
│   └── vite.config.js   Vite configuration
├── tizen/               WGT build tools
├── releases/            Pre-built WGT releases
├── docs/                Project documentation
└── README.md
```

## 4. Workflow Rules

**Hard rules**
- Every code file ≤ 300 LOC — split before it grows past the limit.
- Write code only to spec. Minimum, not maximum. One simple solution.
- No dead code, no speculative abstractions, no unused imports/variables.

**Commit Convention**
- Format: `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`
- Example: `feat(player): preserve playlist channel numbers`
- One logical change per commit.

**Branch Strategy**
- `main` — always deployable
- `feature/<name>` — new functionality
- `fix/<name>` — bug fixes

## 5. Remote Control Keys

| Key | Action |
|-----|--------|
| ↑ / ↓ | Previous / Next channel |
| ← / → | Navigate menus |
| Enter | Select / Play |
| Back | Close menu / Exit |
| 0–9 | Tune to channel number |
| Channel ↑/↓ | Next / Previous channel |
| Play/Pause | Toggle playback |
| 🔴 Red | Favorite toggle |
| 🟢 Green | Groups sidebar |
| 🟡 Yellow | Proxy toggle |
| 🔵 Blue | Open settings |

## 6. Key Features

- No server required — fetches M3U8 playlists directly
- Full remote control support (14 actions)
- HLS / DASH / MSS streaming via Shaka Player
- DRM support (ClearKey, PlayReady)
- Virtualized channel list (5,000+ channels)
- Per-channel proxy toggle

## 7. Installation Methods

1. **Apps2Samsung** (recommended) — network install
2. **Tizen Studio CLI** — `tizen install -n EN-IPTV_Player.wgt -s <TV_IP>`

## 8. Release Process

1. Update version in `package.json` and `player/package.json`
2. Build: `npm run build && npm run tizen`
3. Copy WGT to `releases/`
4. Commit, tag, push
5. Create GitHub release with direct .wgt file
6. Update `packages/Nur-allhi__en-tvplayer.json` if needed
