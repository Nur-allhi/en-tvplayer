# AGENTS.md — EN TV Player

> **Check this file at the start of every conversation.** Update it whenever new conventions or files are introduced.

## 1. Project Overview

**EN TV Player** is a standalone Samsung Tizen TV IPTV player that solves DRM-protected channel playback issues on Tizen OS.

**Key value:** Plays DRM channels that other players can't on Tizen TVs.

**Key principle:** Simple, privacy-focused, no server required.

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
│   │   ├── avplay.js    Native AVPlay fallback (undecodable streams)
│   │   ├── ui.js        Channel list + sidebar
│   │   ├── settings.js  Settings page
│   │   ├── remote.js    Remote control handler
│   │   ├── update.js    Update checker + opt-in ping
│   │   ├── config.js    localStorage settings
│   │   ├── utils.js     Shared utilities
│   │   ├── logic.js     Pure DOM-free logic (testable, no side effects)
│   │   └── *.test.js    Vitest suites, colocated per module (§10)
│   ├── public/          Static assets
│   └── vite.config.js   Vite configuration
├── tizen/               WGT build tools
├── scripts/             Release automation (`npm run release`)
├── proxy/               Desktop testing relay (CORS + Origin/Referer/UA fix)
│   ├── proxy.mjs        HTTPS relay — prefix channel URLs to test DRM on desktop
│   ├── header-rules.json Hostname → header map
│   └── package.json     `npm run proxy` (https://localhost:5001)
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

## 5. Remote Control (Currently Supported)

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate channel list |
| ← / → | Open/close sidebar |
| Enter | Select channel |
| Back | Close menu |
| Volume ↑/↓ | Adjust volume |

**Note:** Other remote buttons (color keys, channel up/down, etc.) are not yet supported.

## 6. Key Features

- **Solves DRM issue** — Plays ClearKey and PlayReady channels on Tizen
- No server required — fetches M3U8 playlists directly
- M3U/M3U8 support
- Per-channel proxy toggle
- Virtualized channel list (5,000+ channels)

## 7. Installation Methods

1. **Apps2Samsung** (recommended) — network install
2. **Tizen Studio CLI** — `tizen install -n EN-IPTV_Player.wgt -s <TV_IP>`

## 8. Release Process — MANDATORY STEPS

**Run `npm run release -- X.Y.Z [--beta]` — it performs ALL steps below. Manual fallback at the end.**

**⚠️ Skipping any step breaks the community package.**

### Step 0: Write + commit the words first (human)
- Add the release content to `CHANGELOG.md` under `## [Unreleased]` and the short in-app entry to `player/src/main.js` (`version: '<base>'`, e.g. `'3.2.0'` for tag `v3.2.0-beta.1`) — the script aborts without them. Commit before running the release.

### What the script does
1. Guards: clean tree, `gh` auth, `tizen/author-key.pem` present (never mints a fresh key on release — a new key = users lose settings), branch rule (stable → `main`, beta → off-main), tag unused.
2. Stable: bumps `package.json`, `player/package.json`, `version.json`, `README.md` badge, dates the changelog (`## [X.Y.Z] - <date>`). Beta: bumps only the two `package.json`s — `version.json` stays pinned to stable.
3. Runs `npm test` + `npm run lint`, builds (`npm run build && npm run tizen`).
4. Copies the WGT: stable → `releases/EN-IPTV_Player_vX.Y.Z.wgt` (+ refreshes unversioned `releases/EN-IPTV_Player.wgt`); beta → `beta/EN-IPTV_Player-testbuild-X.Y.Z-beta.N.wgt` (never committed).
5. Commits (`release: vX.Y.Z` / `chore(beta): prepare …`), annotated tag, push + push tag (asks first unless `--yes`), creates the `gh release` with notes from the changelog (`--prerelease` for beta).
6. Stable only: refreshes `docs/STATS.md` from `gh api` in a follow-up commit — it must postdate the release to include it.
- `--dry-run` prints the plan and runs guards only. `--yes` skips confirmations.

### Beta procedure
- Cut from a non-`main` branch: `npm run release -- X.Y.Z-beta.N --beta`.
- The `testbuild` asset infix keeps it invisible to the community bundle (which matches `EN-IPTV_Player_v.*[.]wgt$`); `version.json` stays pinned so stable users are never prompted to "update" to a beta.
- Testers sideload the pre-release WGT; stable follows after testing.

### Community bundle (auto-detect, no per-release edit)
- `packages/Nur-allhi__en-tvplayer.json` (`source: release`, `branch: main`) matches `EN-IPTV_Player_v.*[.]wgt$` on the latest release — stable releases are picked up automatically as long as the asset name matches. No PR, no JSON edit per release.
- If the schema ever gains a version field, update it in your tizen-community-packages fork and push — no PR needed, the bundle auto-detects.

### Step 1b: Certificate backup (do once, verify each release)
- `tizen/author-key.pem` is gitignored and irreplaceable — back it up encrypted off-machine.
- Future WGTs MUST be signed with the same key or the TV treats them as a new app (settings lost).

### Manual fallback (script unavailable)
- Bump `package.json`, `player/package.json`, plus stable-only `version.json`, `README.md`, changelog dating, in-app entry.
- `npm test && npm run lint && npm run build && npm run tizen`
- Copy the WGT to `releases/` (stable: versioned + unversioned names).
- `git add -A && git commit -m "release: vX.Y.Z" && git tag -a vX.Y.Z -m "Release vX.Y.Z" && git push && git push origin vX.Y.Z`
- `gh release create vX.Y.Z releases/EN-IPTV_Player_vX.Y.Z.wgt --title vX.Y.Z --notes-file <notes>` (`--prerelease` + `testbuild` name for betas)
- Stable only: refresh `docs/STATS.md` via the `gh api` command in that file, commit + push.

## 9. Community Packages Maintenance

- **Repository:** `Apps2Samsung/tizen-community-packages`
- **Your file:** `packages/Nur-allhi__en-tvplayer.json`
- **Always update when:** releasing new version, changing asset filename, or fixing release issues

### How to Update

```bash
# Clone the community repo (your fork)
git clone https://github.com/Nur-allhi/tizen-community-packages.git

# Edit your JSON file
# packages/Nur-allhi__en-tvplayer.json

# Commit and push — no PR, the bundle auto-detects
git add .
git commit -m "update: EN TV Player to vX.Y.Z"
git push
```

## 10. Test Process — MANDATORY FOR LOGIC CHANGES

Vitest covers DOM-free logic only (node env, no jsdom — see `player/vite.config.js` → `test`).
TV-specific behavior (Shaka/EME, AVPlay, remote, CSS, `file://` quirks) still needs sideload + inspector smoke tests.

**Commands**
```bash
npm test              # run the full suite (root delegates to player workspace)
npm run test -w player
npm run lint          # eslint: dead code + undefined refs in player/src
npm run format:check  # prettier check (npm run format to write)
npx vitest            # watch mode, run from player/
```

**Rules for agents**
1. New pure logic goes in `player/src/logic.js` (inputs in, values out — no localStorage, document, timers). Already-DOM-free code (`utils.js`, exported `update.js` helpers) is tested in place.
2. Coupled code (player/main/ui) is tested via extract-then-test: move the pure core to `logic.js`, keep the caller delegating, verify `npm run build` still passes — one behavior-identical refactor, no feature mixed in.
3. Every logic fix gets a regression test first (reproduce → fix → green). Name suites `src/<module>.test.js`, keep each test file ≤ 300 LOC.
4. Before every commit touching `player/src`: `npm test`, `npm run lint` AND `npm run build` must all pass.
5. Never import DOM-coupled modules (`main.js`, `ui.js`, `player.js`, `settings.js`, `remote.js`) in tests — test their extracted helpers instead.
6. A pre-commit hook (husky + lint-staged) runs eslint and prettier on staged files — it blocks on errors, so rules 1–5 stay green. Legacy files are formatted gradually on touch, never in a big-bang reformat.
