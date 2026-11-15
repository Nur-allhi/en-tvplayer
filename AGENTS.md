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
| `gitnexus` | Git operations per `docs/BRANCHING.md` |

## 3. Documentation — read before you touch anything

| Doc | Read it when |
|-----|--------------|
| `docs/v4.PLAN.md` | **Start here.** Master plan: architecture, phases, gates, risks |
| `docs/BRANCHING.md` | Branching, commits, versioning, release process |
| `docs/COMMIT_STYLE.md` | Commit message format — enforced by the `commit-msg` hook |
| `docs/MIGRATION.md` | How the v4 restructure happens — what happens to the old large files |
| `docs/TICKETS.md` | Picking up work · one ticket = one branch = one merge to `dev` |
| `docs/SESSION_LOG.md` | Where the work stands · append an entry when you finish |
| `docs/CONTRIBUTING.md` | How to work on this repo from any machine |
| `docs/TIZEN_COMPAT.md` | Touching platform-specific code · supported Tizen versions |
| `docs/TIZEN_GUIDE.md` | Touching UI, CSS, or remote input |
| `docs/SECURITY.md` | Touching user data or network calls |
| `docs/BUGS.md` | The live defect tracker |

**Every working session appends a `docs/SESSION_LOG.md` entry.** A session
that ends without one is treated as unfinished — that file is how anyone
picks the work up later.

## 4. Project Structure

> The v4 restructure (`docs/v4.PLAN.md` §3.1) moves these into `app/`,
> `player/`, `ui/`, `settings/`, `features/`, `lib/` and `state/` folders.
> Until each phase lands, the flat layout below is current.

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
│   │   └── *.test.js    Vitest suites, colocated per module (§11)
│   ├── public/          Static assets
│   └── vite.config.js   Vite configuration
├── tizen/               WGT build tools
├── scripts/
│   ├── release.mjs      One-command release (`npm run release`)
│   ├── validate-modularity.mjs  Modularity guard (CI)
│   ├── check-bundle-size.mjs    Bundle budget gate (CI)
│   └── metrics.mjs      LOC / bundle / test report (`npm run metrics`)
├── proxy/               Desktop testing relay (CORS + Origin/Referer/UA fix)
│   ├── proxy.mjs        HTTPS relay — prefix channel URLs to test DRM on desktop
│   ├── header-rules.json Hostname → header map
│   └── package.json     `npm run proxy` (https://localhost:5001)
├── .github/workflows/   CI: test · lint · build · modularity · size
├── releases/            Pre-built WGT releases
├── docs/                Project documentation
└── README.md
```

## 5. Workflow Rules

**Hard rules**
- Every code file ≤ 300 LOC — split before it grows past the limit.
- Write code only to spec. Minimum, not maximum. One simple solution.
- No dead code, no speculative abstractions, no unused imports/variables.

**Commit Convention** — full rules: `docs/COMMIT_STYLE.md`
- Format: `<type>(<scope>): <subject> (T-<ticket>)`
- Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`,
  `style`, `merge`
- Scopes (closed list): `player`, `ui`, `settings`, `remote`, `config`,
  `lib`, `app`, `tizen`, `proxy`, `release`, `tooling`, `ci`, `docs`,
  `session`, `roadmap`, `readme`, `agents`, `stats`, `repo`
- Example: `fix(player): bound the segment-404 reload budget (T-120)`
- One logical change per commit. The **body explains why**, not what.
- `feat`, `fix`, `refactor` and `perf` **must** carry a ticket reference and
  a body.
- **Enforced** by the `commit-msg` hook (`scripts/check-commit-msg.mjs`) —
  a non-conforming message is rejected. `npm run lint:commits` audits the
  history.

**Branch Strategy** — full policy in `docs/BRANCHING.md`
- `main` — released, always releasable. **Never commit here directly** — only
  a green merge from `dev`.
- `dev` — integration branch, always working and green.
- `feature/<ticket>-<slug>` / `fix/<ticket>-<slug>` / `chore/<slug>` — one
  ticket per branch, merged into `dev` when done, then deleted.
- `experiment/<slug>` — throwaway spikes, never merged.
- `release/<version>` — release prep (changelog, version bumps) off `dev`.
- No pull requests — this is a solo project. Direct merges to `dev`.

**AI agents:** commit to a feature branch, never `main`. Never mint a signing
key. **Always append to `docs/SESSION_LOG.md`** before finishing — that file is
the only handover mechanism, and the human maintainer verifies the diff
independently of your summary.

**Definition of Done** — `docs/v4.PLAN.md` §11. All eight items apply.

**Release Guard** — `npm run release` refuses to run without
`tizen/author-key.pem`. **Never mint a new signing key** — a different key
makes the TV treat the update as a new app and wipes every user's settings.
`npm run tizen` additionally compares the installed certificate against the
committed `tizen/author-cert.sha256` and **aborts the build** on a mismatch,
so a wrong key cannot be shipped even by accident. Procedure:
`docs/v4.PLAN.md` §8.

## 6. Remote Control (Currently Supported)

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate channel list |
| ← / → | Open/close sidebar |
| Enter | Select channel |
| Back | Close menu / exit (debounced ~600 ms) |
| Volume ↑/↓ | Adjust volume |
| Red / Green / Yellow / Blue | Green: groups · Blue: settings (Red/Yellow reserved) |
| Channel Up/Down | Previous / next channel |
| Numbers | Jump to channel |
| Media keys | Play/pause, stop, next/prev track |
| `R` | Force-reload the current channel |

Tizen special keys are registered at boot via
`window.tizen.tvinputdevice.registerKey()` — unregistered keys never fire
(`docs/TIZEN_GUIDE.md` §3.2).

## 7. Key Features

- **Solves DRM issue** — Plays ClearKey and PlayReady channels on Tizen
- No server required — fetches M3U8 playlists directly
- M3U/M3U8 + Xtream Codes support
- Per-channel proxy toggle
- Virtualized channel list (5,000+ channels)
- Resume last channel and group on launch

**Supported platform:** Tizen 5.0 and newer. Tizen 4.0 is **not** supported —
measured and ruled out in `docs/TIZEN_COMPAT.md` §3.1 (Shaka Player 5.x
requires `Proxy`, which Tizen 4's Chromium 47 lacks and which cannot be
polyfilled).

## 8. Installation Methods

1. **Apps2Samsung** (recommended) — network install
2. **Tizen Studio CLI** — `tizen install -n EN-IPTV_Player.wgt -s <TV_IP>`

## 9. Release Process — MANDATORY STEPS

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

## 10. Community Packages Maintenance

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

## 11. Test Process — MANDATORY FOR LOGIC CHANGES

Vitest covers DOM-free logic only (node env, no jsdom — see `player/vite.config.js` → `test`).
TV-specific behavior (Shaka/EME, AVPlay, remote, CSS, `file://` quirks) still needs sideload + inspector smoke tests.

**Commands**
```bash
npm test              # run the full suite (root delegates to player workspace)
npm run test -w player
npm run lint          # eslint: dead code + undefined refs in player/src
npm run validate      # modularity guard: LOC, exports, circular imports, DOM purity
npm run metrics       # LOC / bundle / test report
npm run format:check  # prettier check (npm run format to write)
npx vitest            # watch mode, run from player/
```

**Rules for agents**
1. New pure logic goes in `player/src/logic.js` (inputs in, values out — no localStorage, document, timers). Already-DOM-free code (`utils.js`, exported `update.js` helpers) is tested in place. As v4 lands, pure helpers move to `player/src/lib/` — see `docs/v4.PLAN.md` §3.1.
2. Coupled code (player/main/ui) is tested via extract-then-test: move the pure core to `logic.js`, keep the caller delegating, verify `npm run build` still passes — one behavior-identical refactor, no feature mixed in.
3. Every logic fix gets a regression test first (reproduce → fix → green). Name suites `src/<module>.test.js`, keep each test file ≤ 300 LOC.
4. Before every commit touching `player/src`: `npm test`, `npm run lint`, `npm run build` AND `npm run validate` must all pass.
5. Never import DOM-coupled modules (`main.js`, `ui.js`, `player.js`, `settings.js`, `remote.js`) in tests — test their extracted helpers instead.
6. A pre-commit hook (husky + lint-staged) runs eslint and prettier on staged files — it blocks on errors, so rules 1–5 stay green. Legacy files are formatted gradually on touch, never in a big-bang reformat.
7. The modularity guard uses a **ratchet**: `scripts/modularity-baseline.json` records the known v3.2.0 violations. CI fails on *new* violations only. When you fix a tracked violation, run `node scripts/validate-modularity.mjs --update` to shrink the baseline. The goal is an empty baseline, then `--strict` forever.

## 12. Modularity Guard

`npm run validate` enforces the v4 rules (`docs/v4.PLAN.md` §3.2):

| Rule | Check |
|------|-------|
| File size | every file under `player/src` ≤ 300 LOC |
| Exports | ≤ 15 exports per file |
| Circular imports | zero cycles in the import graph |
| DOM purity | `logic.js` and `lib/` never touch `document`, `window`, `localStorage`, `navigator` |
| Debug output | no `console.log()` in app source |

CI runs it on every push and merge to `dev`. See
`scripts/validate-modularity.mjs`.

## 13. Session Log — MANDATORY

Append an entry to `docs/SESSION_LOG.md` **before you finish a working
session**. Newest entry first, using the template at the top of that file:
what changed, how it was verified, decisions made, what to watch out for, and
the next step. This file is how the next person (or the next agent) picks up
the work without reading the whole history.
