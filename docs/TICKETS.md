# TICKETS — EN TV Player

> **Status:** authoritative backlog. **Date:** 2026-11-15.
> **Rule:** one ticket = one branch = one merge to `dev`. Atomic.
> **Workflow:** `docs/BRANCHING.md` §3 · **Plan:** `docs/v4.PLAN.md`
> **Solo project** — no pull requests, no reviewers.

---

## Ticket states

| State | Meaning |
|-------|---------|
| `proposed` | Idea, not started |
| `ready` | Spec is clear, can be picked up |
| `in-progress` | Branch open, work underway |
| `review` | Branch ready to merge into `dev` |
| `done` | Merged — record the merge SHA |
| `needs-tv` | Merged, but playback behaviour is unverified on hardware |
| `blocked` | Waiting on something — say what |

A ticket is only `done` when it meets the **Definition of Done**
(`docs/v4.PLAN.md` §11).

---

# Milestone v4.0.0

## Phase 0 — Foundations (M0)

### T-100 — CI workflow
- **Type:** chore · **Priority:** P0 · **Size:** S (~60 LOC)
- **Spec:** `.github/workflows/ci.yml` running on push + merge: `npm test`,
  `npm run lint`, `npm run validate`, `npm run build`, and the bundle size
  gate. Fail the job on any failure.
- **Acceptance:** a push with a failing test shows a red check, and the merge
  into `dev` is stopped by that red check.
- **Depends:** T-101 (or gate inline)
- **Notes:** no `.github/` directory exists today. Enable "require status
  checks to pass" on `dev` in GitHub settings — with no required reviewers,
  since there is only one maintainer.

### T-101 — Modularity validator script
- **Type:** chore · **Priority:** P0 · **Size:** S (~150 LOC)
- **Spec:** `scripts/validate-modularity.mjs`. Checks: every file under
  `player/src` ≤ 300 LOC; ≤ 15 exports per file; zero circular imports
  (walk the import graph); `lib/` and `logic.js` contain no DOM references
  (`document`, `window`, `localStorage`).
- **Acceptance:** exits non-zero with a clear message naming the file and the
  rule broken. Wired into `npm run lint` and CI.
- **Depends:** —

### T-102 — Metrics script
- **Type:** chore · **Priority:** P1 · **Size:** XS (~80 LOC)
- **Spec:** `npm run metrics` prints LOC per file (sorted), the count of
  files over 300 LOC, bundle size raw + gzip, and the test count.
- **Acceptance:** output is stable enough to diff between commits; used as
  the v4 progress baseline (`docs/v4.PLAN.md` §2).

### T-103 — CHANGELOG `[Unreleased]` section
- **Type:** docs · **Priority:** P0 · **Size:** XS
- **Spec:** add `## [Unreleased]` with an empty `###` subsection to
  `CHANGELOG.md`.
- **Acceptance:** `npm run release -- 4.0.0 --dry-run` gets past the
  changelog guard.
- **Notes:** `scripts/release.mjs` aborts without it — a real release blocker.

### T-104 — Restore the release signing key
- **Type:** chore · **Priority:** **P0 — release blocker** · **Size:** XS
- **Spec:** restore `tizen/author-key.pem` + `author-cert.pem` from the
  off-machine backup. Verify the certificate matches the one that signed
  every released WGT.
- **Acceptance:** `openssl x509 -in tizen/author-cert.pem -noout -fingerprint
  -sha256 -dates` prints
  `40:71:40:30:04:D9:49:25:55:68:FF:44:B8:36:47:35:22:52:89:61:E6:0F:BE:57:3A:9B:28:5B:7D:B7:51:43`
  and `notBefore=Aug 28 06:55:23 2026 GMT`. The private key passes
  `openssl rsa -check`, and its modulus matches the certificate's.
- **Spec detail:** `docs/v4.PLAN.md` §8. **If the fingerprint does not match,
  stop** — do not ship.
- **Status:** ✅ done 2026-11-15 — restored and verified end to end: a WGT
  built with it carries a byte-identical signer certificate to the released
  v3.2.0. The packager now refuses to build on a fingerprint mismatch
  (T-208).

### T-208 — Packager refuses to sign with the wrong key
- **Type:** fix · **Priority:** **P0** · **Size:** S (~40 LOC)
- **Spec:** `tizen/author-cert.sha256` records the expected signing
  certificate fingerprint and is committed to the repo (the key itself stays
  gitignored). `tizen/package.mjs` compares it against the certificate
  actually present and **aborts the build** on mismatch. Key generation now
  prints a loud warning instead of doing it silently.
- **Acceptance:** with a non-matching certificate installed, `npm run tizen`
  exits non-zero and prints the expected and found fingerprints. With the
  correct certificate it builds normally.
- **Status:** ✅ done 2026-11-15

### T-105 — Documentation set for v4
- **Type:** docs · **Priority:** P0 · **Size:** M (docs only)
- **Spec:** `docs/v4.PLAN.md`, `docs/TIZEN_COMPAT.md`, `docs/BRANCHING.md`,
  `docs/SESSION_LOG.md`, `docs/CONTRIBUTING.md`, rewritten `docs/TICKETS.md`.
- **Acceptance:** a new contributor can go from clone to a working change using only
  `docs/CONTRIBUTING.md`.
- **Status:** ✅ done 2026-11-15

### T-106 — Fix high-severity audit findings
- **Type:** chore · **Priority:** P2 · **Size:** S
- **Spec:** resolve the `vite ≤6.4.3` and `source-map-js` advisories
  (`npm audit fix`). Dev-server only — not shipped to TVs.
- **Acceptance:** `npm audit` reports no high/critical; build and tests still pass.

### T-107 — Toolchain portability fixes
- **Type:** fix · **Priority:** P0 · **Size:** XS
- **Spec:** two fixes on `main`, currently uncommitted:
  1. `proxy/proxy.mjs` — pass `algorithm: 'sha256'` to `selfsigned`; the
     SHA-1 default is rejected by OpenSSL 4 (`invalid digest`) and the relay
     crashes at startup.
  2. `tizen/package.mjs` — pick the `2>nul` vs `2>/dev/null` redirect by
     `process.platform`; the Windows form creates a literal `nul` file on Linux.
- **Acceptance:** `npm run proxy` starts on Linux; `npm run tizen` creates no
  stray file in `tizen/`.
- **Status:** 🔄 in progress — applied to the working tree, needs a commit.

---

## Phase 1 — Pure-logic extraction (M1)

### T-110 — `lib/m3u.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~180 LOC)
- **Spec:** move `parseM3u`, `parseStreamHeaders`, `processStreamUrl`,
  `findNameSeparator` out of `utils.js`. DOM-free, no side effects.
- **Acceptance:** existing `parse-m3u.test.js` passes against the new module
  **before** the old code is deleted; ≥ 30 tests total; `utils.js` shrinks.
- **Depends:** —

### T-111 — `lib/url.js`
- **Type:** refactor · **Priority:** P0 · **Size:** S (~120 LOC)
- **Spec:** move `withAuthQuery`, `redactUrl`, `extractAuthQuery` here.
- **Acceptance:** ≥ 20 tests, including the `data:` license-URI case that
  must never get a query string appended (BUG-013 / v3.0.4 regression).

### T-112 — `lib/drm.js`
- **Type:** refactor · **Priority:** P0 · **Size:** S (~110 LOC)
- **Spec:** move `parseLicenseKeyValue` + hex normalisation here.
- **Acceptance:** ≥ 15 tests covering all three `license_key` forms (single
  `KID:KEY`, unquoted dict, JSON dict) plus the rejection cases.

### T-113 — `lib/time.js`
- **Type:** refactor · **Priority:** P1 · **Size:** XS (~60 LOC)
- **Spec:** move `timeAgo`, `formatDate` out of `settings.js`.
- **Acceptance:** ≥ 8 tests; no locale-dependence surprises (pin the locale
  in assertions).

### T-114 — `lib/capabilities.js`
- **Type:** feat · **Priority:** P0 · **Size:** S (~70 LOC)
- **Spec:** runtime capability probe (`webAPIVersion`, `AbortController`,
  `trimStart`, `ResizeObserver`, `requestVideoFrameCallback`,
  `mediaCapabilities`, `hasAvplay`, `hasShaka`). Single source of truth.
- **Acceptance:** ≥ 10 tests with a mocked `window`; every platform decision
  in the app reads from here and nowhere else.
- **Spec detail:** `docs/TIZEN_COMPAT.md` §4.

---

## Phase 2 — `player/` split (M2)

### T-120 — `player/recovery.js` + recovery composition tests
- **Type:** refactor + test · **Priority:** P0 · **Size:** M (~280 LOC)
- **Spec:** isolate `handlePlayerError`, `scheduleReconnect`,
  `scheduleForbiddenReload`, `giveUpTune`, `isRecoverable`,
  `isTransientBlip`. The decision functions in `logic.js` stay **unchanged** —
  `recovery.js` calls them, never reimplements them.
- **Acceptance:** ≥ 30 tests covering the *composition* (which decision maps
  to which action) for every branch: transient blip, 401/403 retry,
  token refresh, 404 re-sync, hard-reload budget → give up.
- **Notes:** this is the highest-risk file in the app. Tests first.

### T-121 — `player/init.js` + `player/load.js`
- **Type:** refactor · **Priority:** P0 · **Size:** L (~450 LOC combined)
- **Spec:** split `player.js`. `init.js` = `initPlayer` + `destroyPlayer`;
  `load.js` = `loadChannel` + `reloadChannel`.
- **Acceptance:** `player/index.js` exports the same 24 names as the old
  `player.js`; `npm run build` bundle size within ±2 % of before.

### T-122 — `player/events.js` + `player/stream.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~330 LOC combined)
- **Spec:** `events.js` = the `on*` subscription callbacks; `stream.js` =
  resolutions, audio tracks, active track.
- **Acceptance:** same 24 exports; DRM path untouched.

### T-123 — Delete `player.js`
- **Type:** refactor · **Priority:** P0 · **Size:** XS
- **Acceptance:** `player.js` gone; `player/index.js` is the only entry;
  every importer updated; full suite green.

---

## Phase 3 — `ui/` split (M3)

### T-130 — `ui/state.js` (shared state holder)
- **Type:** refactor · **Priority:** P0 · **Size:** S (~120 LOC)
- **Spec:** move `ui.js`'s module-level state (`channels`, `currentIndex`,
  `focusedIndex`, `virtualStart/End`, `sidebarOpen`, `isFullscreen`,
  `rightSidebarOpen`, `rightResolutions`, `rightFocus`, `rightItems`,
  `sidebarMode`, `groups`, `selectedGroup`, `groupFocusedIndex`,
  `searchQuery`, `searchResults`, `searchFocus`) into one exported state
  object that each UI module imports.
- **Acceptance:** no behavioural change. **Do not** convert to a reactive
  store here — that is T-160.
- **Notes:** the shared-state coupling is the main hazard in this phase.

### T-131 — `ui/dialogs.js`
- **Type:** refactor · **Priority:** P0 · **Size:** S (~100 LOC)
- **Spec:** `isDialogOpen`, `showConfirmDialog`, `hideConfirmDialog`,
  `dialogNavigate`, `dialogSelect`.
- **Acceptance:** zero dependencies on other UI modules; confirm dialog works
  for exit, delete playlist, and update notice.

### T-132 — `ui/osd.js`
- **Type:** refactor · **Priority:** P0 · **Size:** S (~150 LOC)
- **Spec:** channel OSD, buffering pill, empty-state brand, watermark,
  play-state overlay, progress toast.
- **Acceptance:** the z-index contract from `docs/TIZEN_GUIDE.md` §6.3 holds
  (veil 30, pills 40, splash 200, modals 300).

### T-133 — `ui/sidebar.js` + `ui/search.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~380 LOC combined)
- **Spec:** sidebar toggle, group list, group navigation, `showGroupChannels`,
  `refreshGroupVisibility`; cross-group search (`enterSearch`, `exitSearch`,
  `searchNavigate`, `searchSelect`, rendering).
- **Acceptance:** the search flow (T-037) still works, hidden groups never
  surface, Back always lands on groups.

### T-134 — `ui/right-menu.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~250 LOC)
- **Spec:** right sidebar, resolution list, audio list, proxy toggle,
  `rightSidebarNavigateUp/Down`, `rightSidebarSelect`.
- **Acceptance:** quality selection, audio selection, reload, refresh,
  settings and proxy all reachable by remote.

### T-135 — `ui/core.js` + delete `ui.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~280 LOC)
- **Spec:** `init`, `renderChannelList` (virtualised), `selectChannel`,
  `navigateUp/Down`, `selectFocused`, `jumpToNumber`, `getDisplayChannels`,
  fullscreen helpers, inactivity timer.
- **Acceptance:** `ui/index.js` exports the same **74 names** as the old
  `ui.js`; a scripted checklist of remote flows passes unchanged.

---

## Phase 4 — `settings/` split (M4)

### T-140 — `settings/nav.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~200 LOC)
- **Spec:** `buildFocusOrder`, `applyFocus`, `clearFocus`, `navigate`,
  `navigateNav`, `selectFocused`, `moveSettingsFocus`.
- **Acceptance:** the BUG-011/012 remote paths still work — OK in the proxy
  URL field saves, OK in a playlist name field advances to the URL field, OK
  in the URL field saves.

### T-141 — `settings/render.js` + `settings/playlists.js`
- **Type:** refactor · **Priority:** P0 · **Size:** L (~480 LOC combined)
- **Spec:** card rendering vs. playlist CRUD.
- **Acceptance:** all playlist operations work by remote (add, edit, rename,
  delete, fetch active, M3U + Xtream types).

### T-142 — `settings/playback.js` + delete `settings.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~150 LOC)
- **Spec:** quality toggle, auto-refresh, display toggles (watermark, badge),
  groups manager.
- **Acceptance:** `settings/index.js` exports the same 8 names; toggles
  persist immediately (the BUG-011 regression must not return).

---

## Phase 5 — `main.js` split + app layer (M5)

### T-150 — `app/boot.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~180 LOC)
- **Spec:** `init`, splash staging (`showBootSplash`, `hideBootSplash`,
  typewriter), first-run, onboarding, What's New, `startPlayer`,
  `restoreLastSession`.
- **Acceptance:** splash staging still chains on completion callbacks (never
  fixed sleeps) — `docs/TIZEN_GUIDE.md` §7.

### T-151 — `app/remote.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~200 LOC)
- **Spec:** `handleRemoteAction` routing, `registerTizenKeys`, `zapChannel`.
- **Acceptance:** every documented remote key works (arrows, OK, Back, digits,
  CH ±, colour keys, media keys, `R`).

### T-152 — `app/index.js` + `main.js` entry
- **Type:** refactor · **Priority:** P0 · **Size:** S (~160 LOC combined)
- **Spec:** `main.js` becomes a thin entry (≤ 60 LOC). `app/index.js` wires
  subsystems.
- **Acceptance:** `main.js` ≤ 60 LOC; boot, resume, first-run, onboarding all
  verified.

---

## Phase 6 — Modern design system (M6)

### T-160 — Design tokens
- **Type:** style · **Priority:** P0 · **Size:** M
- **Spec:** extract colour/spacing/typography/radius/shadow scales into
  `:root` custom properties in `styles/base.css`. Update the visual system
  per `docs/FRONTEND_SPEC.md`.
- **Acceptance:** no hard-coded colours left outside the token file;
  all sizes still scale via `--tv-scale`.

### T-161 — Split `styles.css`
- **Type:** refactor · **Priority:** P0 · **Size:** M
- **Spec:** `styles.css` → `styles/{base,layout,sidebar,player,settings,library,overlays}.css`,
  imported from `base.css`.
- **Acceptance:** each file ≤ 300 LOC; visual output unchanged (screenshot
  before/after).

### T-162 — Accessibility pass
- **Type:** feat · **Priority:** P1 · **Size:** M
- **Spec:** `aria-live="polite"` on the loading status; `role="dialog"` +
  `aria-modal="true"` on modals; focus rings on every focusable element;
  ≥ 4.5:1 contrast for body text; never rely on colour alone (add an icon to
  error/success); `prefers-reduced-motion` respected.
- **Acceptance:** every screen fully usable by remote alone; contrast audit
  passes.

---

## Phase 7 — State container + plugin wiring (M7)

### T-170 — `state/` store
- **Type:** refactor · **Priority:** P0 · **Size:** M (~180 LOC)
- **Spec:** `createStore` + `subscribe`. Convert `ui/state.js` (T-130) and
  `app` globals into `appState`, `uiState`, `vodState`.
- **Acceptance:** ≥ 15 tests on the store; no behaviour change.

### T-171 — `app/plugins.js` registry
- **Type:** feat · **Priority:** P0 · **Size:** S (~60 LOC)
- **Spec:** the feature registry. `inlineDynamicImports: true` in the Vite
  config so `import()` works under the IIFE build.
- **Acceptance:** disabling a feature removes all its UI and remote bindings
  with no other file edited.
- **Spec detail:** `docs/v4.PLAN.md` §3.3.

### T-172 — Migrate existing features to plugins
- **Type:** refactor · **Priority:** P0 · **Size:** M
- **Spec:** move `search`, proxy toggle, AVPlay fallback and the Tizen compat
  shim into `features/`.
- **Acceptance:** each feature is a self-contained module with a documented
  contract; `app/index.js` no longer knows feature internals.

### T-173 — Remote-action routing via plugins
- **Type:** refactor · **Priority:** P1 · **Size:** M
- **Spec:** `handleRemoteAction` dispatches through registered routes so a
  feature can own a key without editing `app/remote.js`.
- **Acceptance:** a new remote binding is added entirely inside a feature
  module.

---

## Phase 8 — VOD: movies + series (M8)

### T-180 — VOD data model + storage
- **Type:** feat · **Priority:** P0 · **Size:** M (~200 LOC)
- **Spec:** `MediaEntry` / `Episode` typedefs (`docs/v4.PLAN.md` §8.1), a
  `media-id.js` slug helper, and a `vodState` store persisted under
  `en_settings.movies`.
- **Acceptance:** ≥ 20 tests; ids are stable across reordering and re-fetch.

### T-181 — Add media by URL / manifest
- **Type:** feat · **Priority:** P0 · **Size:** M (~250 LOC)
- **Spec:** the user adds a source by **direct stream URL**, **M3U playlist**,
  or **JSON manifest**. No page scraping — pages are not CORS-readable from
  the TV.
- **Acceptance:** all three source kinds import; a malformed manifest shows a
  plain-English error, not a stack trace.

### T-182 — `ui/library.js` — movies & series browser
- **Type:** feat · **Priority:** P0 · **Size:** M (~250 LOC)
- **Spec:** a Movies / Series browser in the left sidebar, reusing the group
  list pattern.
- **Acceptance:** fully remote-navigable; Back always returns one level and
  never strands the user.

### T-183 — Episode browsing + resume
- **Type:** feat · **Priority:** P0 · **Size:** M (~200 LOC)
- **Spec:** season/episode lists for series; persist the resume position per
  media id; offer "Resume" on the detail card.
- **Acceptance:** resuming restores position within ±5 s.

### T-184 — Audio / subtitle / quality pickers
- **Type:** feat · **Priority:** P1 · **Size:** M (~250 LOC)
- **Spec:** right-menu entries for audio tracks (Shaka text/audio tracks),
  subtitles, and quality.
- **Acceptance:** pickers list real tracks from the loaded stream, not a
  hard-coded list; selection takes effect immediately.

### T-185 — VOD playback integration
- **Type:** feat · **Priority:** P0 · **Size:** M
- **Spec:** VOD reuses the existing engine — `player/load.js` → Shaka →
  native AVPlay fallback. Add ClearKey support when the manifest declares it.
- **Acceptance:** a movie plays end to end; DRM manifests play with ClearKey;
  an unplayable stream shows the existing plain-language error.

---

## Phase 9 — Tizen 5.0 compatibility (M9)

### T-190 — `features/tizen-compat.js`
- **Type:** feat · **Priority:** P0 · **Size:** S (~120 LOC)
- **Spec:** guarded shims for `AbortController`, `trimStart`,
  `ResizeObserver` — only installed when missing.
- **Acceptance:** the app boots and plays on a Tizen 5.0 TV; shims are no-ops
  on modern engines.
- **Spec detail:** `docs/TIZEN_COMPAT.md` §3.

### T-191 — Engine fallback messaging
- **Type:** feat · **Priority:** P0 · **Size:** S (~90 LOC)
- **Spec:** when Shaka is unusable but AVPlay exists → native-only mode with a
  clear notice that DRM is unavailable. When neither works → a plain message,
  never a blank screen.
- **Acceptance:** no blank screen on any engine combination.

### T-192 — About panel: engine + platform info
- **Type:** feat · **Priority:** P1 · **Size:** S (~100 LOC)
- **Spec:** Settings → About shows app version, TV API version, active engine
  (Shaka / Native / Browser), AVPlay availability, and native-playback support.
- **Acceptance:** matches the Tizen key-registration and DRM diagnostics
  already exposed in the About card.

---

## Phase 10 — Diagnostics & polish (M10 → v4.1)

### T-200 — Log ring buffer + copy diagnostics
- **Type:** feat · **Priority:** P1 · **Size:** M (~200 LOC)
- **Spec:** in-memory ring of the last 200 `[app]` log lines; Settings → About
  → "Copy diagnostics" (version, TV model, log tail).
- **Acceptance:** no PII, no stream tokens (`redactUrl` applied); the copied
  text is directly postable in a GitHub issue.

### T-201 — Favorites feature
- **Type:** feat · **Priority:** P1 · **Size:** M (~150 LOC)
- **Spec:** red key toggles a favourite; favourites appear as a pinned group;
  stored in `en_settings.favorites`; implemented as a plugin.
- **Acceptance:** implemented entirely inside `features/favorites.js` — no
  change to `app/remote.js` (proves T-173).

### T-202 — Info bar with clock
- **Type:** feat · **Priority:** P2 · **Size:** S (~120 LOC)
- **Spec:** a brief OSD after a channel switch showing name, group,
  resolution, stream type, and the clock.
- **Acceptance:** auto-hides after 8 s; plugin-implemented.

### T-203 — GitHub issue templates
- **Type:** chore · **Priority:** P1 · **Size:** XS
- **Spec:** `.github/ISSUE_TEMPLATE/` asking for app version, TV model, Tizen
  version, playlist type, and log lines.
- **Acceptance:** the template matches the info `docs/CONTRIBUTING.md` §8 asks for.

---

### T-209 — Enforced commit message format
- **Type:** chore · **Priority:** P0 · **Size:** M (~250 LOC)
- **Spec:** a commit-message convention that is machine-checked, not just
  written down. `scripts/check-commit-msg.mjs` validates the header format,
  a closed list of types and scopes, the ticket reference, the body, the
  subject rules and the trailers. Wired in as a `commit-msg` husky hook so a
  non-conforming message is rejected at commit time.
- **Acceptance:** a bad message is rejected with an actionable reason (bad
  type, unknown scope, missing ticket, missing body, trailing period,
  uppercase start, junk subject, over-long header). `feat`/`fix`/`refactor`/
  `perf` require both a ticket reference and a body. The release script's own
  commits conform. `npm run lint:commits` audits the history.
- **Status:** ✅ done 2026-11-15
- **Note:** the pre-2026-11-15 history is not rewritten — rewriting would
  change every SHA and break the release tags. The audit reports where the
  convention starts.

---

## Backlog (unprioritised)

| # | Feature | Size | Notes |
|---|---------|------|-------|
| T-300 | EPG (XMLTV) mini-grid | L | Needs a guide source; CORS applies |
| T-301 | Parental lock (PIN per group) | M | Complements group hiding |
| T-302 | Multi-user profiles | L | localStorage namespacing |
| T-303 | Poster art / thumbnails | M | Lazy load, cache cap |
| T-304 | Export / import watchlist | S | JSON, no server |
| T-305 | `manualChunks` bundle split | S | Needs `format: 'es'`; measure on TV first |
| T-306 | Voice control | M | Tizen-specific API, low priority |

---

# History — milestones v1.x–v3.x (closed)

These shipped and are recorded in `CHANGELOG.md` and `docs/BUGS.md`. Kept for
traceability; the tickets themselves are not reopened.

| Milestone | Tickets | Shipped |
|-----------|---------|---------|
| v1.1.1 "Bug Fixes" | T-001 … T-004 | v1.1.0 |
| v1.2.0 "Daily Driver" | T-010 … T-012 | planned; resume landed in v3.1.0, favourites/info bar deferred to v4 |
| v1.3.0 "Code Quality" | T-020 … T-024 | v1.3.0 — split plan superseded by `docs/v4.PLAN.md` |
| v2.0.0 "Real TV Experience" | T-030 … T-032 | audio selection landed v3.0.3; EPG + parental lock → T-300/T-301 |
| v2.1.0 "Kodi Compat" | T-033, T-034 | v2.1.0 |
| v2.3.0 "Playlist & Discovery" | T-035 … T-038 | v2.2.0 / v3.0.0 |

**Known deferral:** T-020…T-024 (the original file-split tickets) were
deferred in v1.3.0 because the code was untested and tightly coupled. The v4
plan (`docs/v4.PLAN.md`) supersedes them with a tested, phased approach.
