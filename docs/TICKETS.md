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

> **Deferred TV test (2026-11-17):** the maintainer chose to verify on hardware
> later. T-130, T-131 and T-132 are merged and gated but their status lines say
> "No TV verification claimed" — treat them as `needs-tv` until a device check
> happens. Same for T-184, T-185, T-190 and T-191 (pre-marked `needs-tv`).
> Search `docs/SESSION_LOG.md` for "No TV verification claimed" to find every
> affected change. Nothing here can be verified without a TV attached to the
> machine, so no agent should mark these as hardware-verified.
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
- **Status:** ✅ done 2026-11-15 — `.github/workflows/ci.yml` runs on push and
  PR for `main`/`dev`. Branch protection enabled on `dev` with both checks
  required (`Test · Lint · Build · Modularity`, `WGT packaging`), no required
  reviewers, force-push and deletion blocked. Verified via the branch
  protection API.

### T-210 — Make the formatting check enforceable
- **Type:** chore · **Priority:** P1 · **Size:** S
- **Spec:** `npm run format:check` reported 26 files on a clean checkout, so
  CI carried `continue-on-error: true` and formatting had no signal at all.
  Fix the cause rather than the symptom.
- **Acceptance:** `npm run format:check` exits 0 on a clean checkout; CI runs
  it without `continue-on-error`; the never-formatted legacy files are
  tracked as a shrinking list, not reformatted in bulk (`AGENTS.md` §11.6).
- **Status:** ✅ done 2026-11-16 — two causes, two fixes. Line endings (21 of
  26): added `.gitattributes` (`* text=auto eol=lf`) and prettier
  `endOfLine: "auto"`; the repo stored LF while `core.autocrlf` checked out
  CRLF. Real drift (5 files): `.prettierignore` lists `settings.js`,
  `styles.css`, `avplay.js`, `remote.js`, `xtream.js` — measured at ~3158
  lines if reformatted together, which §11.6 forbids. CI step now runs
  `npm run format:check` with no escape hatch. Result: 26 failures → 0.

### T-101 — Modularity validator script
- **Type:** chore · **Priority:** P0 · **Size:** S (~150 LOC)
- **Spec:** `scripts/validate-modularity.mjs`. Checks: every file under
  `player/src` ≤ 300 LOC; ≤ 15 exports per file; zero circular imports
  (walk the import graph); `lib/` and `logic.js` contain no DOM references
  (`document`, `window`, `localStorage`).
- **Acceptance:** exits non-zero with a clear message naming the file and the
  rule broken. Wired into `npm run lint` and CI.
- **Depends:** —
- **Status:** ✅ done 2026-11-15 — see `docs/SESSION_LOG.md`
  "v4 groundwork committed and CI-verified" (`cd809e6`).

### T-102 — Metrics script
- **Type:** chore · **Priority:** P1 · **Size:** XS (~80 LOC)
- **Spec:** `npm run metrics` prints LOC per file (sorted), the count of
  files over 300 LOC, bundle size raw + gzip, and the test count.
- **Acceptance:** output is stable enough to diff between commits; used as
  the v4 progress baseline (`docs/v4.PLAN.md` §2).
- **Status:** ✅ done 2026-11-15 — see `docs/SESSION_LOG.md`
  "v4 groundwork committed and CI-verified" (`cd809e6`).

### T-103 — CHANGELOG `[Unreleased]` section
- **Type:** docs · **Priority:** P0 · **Size:** XS
- **Spec:** add `## [Unreleased]` with an empty `###` subsection to
  `CHANGELOG.md`.
- **Acceptance:** `npm run release -- 4.0.0 --dry-run` gets past the
  changelog guard.
- **Notes:** `scripts/release.mjs` aborts without it — a real release blocker.
- **Status:** ✅ done 2026-11-15 — see `docs/SESSION_LOG.md`
  "v4 groundwork committed and CI-verified" (`cd809e6`).

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
- **Status:** ✅ done 2026-11-15 — `npm audit fix` moves vite 6.3.5 → 6.4.6,
  source-map-js 1.2.1 → 1.2.2, vitest 5.0.2 → 5.1.0, eslint 10.11 → 10.15.
  `npm audit` reports **0 vulnerabilities**. All four gates green and the
  built bundle is byte-identical (`index.4Ng0uPJB.js`, 931.2 KB), confirming
  nothing reaching the app changed.

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
- **Status:** ✅ done — committed as `cb9ccbe`
  (`fix(tooling): make the proxy and WGT packager work on Linux`).

---

## Phase 1 — Pure-logic extraction (M1)

### T-110 — `lib/m3u.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~180 LOC)
- **Spec:** move `parseM3u`, `parseStreamHeaders`, `processStreamUrl`,
  `findNameSeparator` out of `utils.js`. DOM-free, no side effects.
- **Acceptance:** existing `parse-m3u.test.js` passes against the new module
  **before** the old code is deleted; ≥ 30 tests total; `utils.js` shrinks.
- **Depends:** —
- **Status:** ✅ done 2026-11-16 — `utils.js` 348 → **66 LOC**, violation gone
  from the baseline. `lib/` created: `m3u.js` (157), `url.js` (73),
  `drm.js` (57). Tests 61 → 86 (+25 in `lib/m3u.test.js`). Bundle 953 493 B vs
  953 499 B before — a 6-byte delta from module-boundary naming, well inside
  the ±2 % tolerance.
- **Sequencing correction:** this ticket cannot land alone. `parseM3u` calls
  `extractAuthQuery` (T-111) and `parseLicenseKeyValue` (T-112); moving it
  first would make `lib/m3u.js` import `../utils.js` while `utils.js` imports
  `lib/m3u.js` — a circular import the validator forbids. **T-111 and T-112
  therefore land with, or before, T-110.** Their modules were extracted here
  as part of the same move; their own test-expansion acceptance criteria
  remain open and are tracked under T-111/T-112.

### T-111 — `lib/url.js`
- **Type:** refactor · **Priority:** P0 · **Size:** S (~120 LOC)
- **Spec:** move `withAuthQuery`, `redactUrl`, `extractAuthQuery` here.
- **Acceptance:** ≥ 20 tests, including the `data:` license-URI case that
  must never get a query string appended (BUG-013 / v3.0.4 regression).
- **Depends:** —
- **Status:** ✅ done 2026-11-16 — module moved with T-110
  (`player/src/lib/url.js`, 73 LOC); colocated **`lib/url.test.js` (152 LOC,
  34 tests)** added, exceeding the ≥20 bar. Covers `withAuthQuery` append/merge
  /fragment behaviour, the `data:`/`blob:`/`file:` non-network cases
  (BUG-013 / v3.0.4 regression), regex-metacharacter param names, and all
  `extractAuthQuery` cookie cases including duplicate suppression.

### T-112 — `lib/drm.js`
- **Type:** refactor · **Priority:** P0 · **Size:** S (~110 LOC)
- **Spec:** move `parseLicenseKeyValue` + hex normalisation here.
- **Acceptance:** ≥ 15 tests covering all three `license_key` forms (single
  `KID:KEY`, unquoted dict, JSON dict) plus the rejection cases.
- **Depends:** —
- **Status:** ✅ done 2026-11-16 — module moved with T-110
  (`player/src/lib/drm.js`, 57 LOC); colocated **`lib/drm.test.js` (102 LOC,
  19 tests)** added, exceeding the ≥15 bar. Covers all three `license_key`
  forms (single `KID:KEY`, unquoted dict, JSON dict), hex normalisation and
  dash stripping, and the rejection cases. Two of the first-draft
  expectations were wrong and the tests caught it — see `docs/SESSION_LOG.md`.

### T-113 — `lib/time.js`
- **Type:** refactor · **Priority:** P1 · **Size:** XS (~60 LOC)
- **Spec:** move `timeAgo`, `formatDate` out of `settings.js`.
- **Acceptance:** ≥ 8 tests; no locale-dependence surprises (pin the locale
  in assertions).
- **Status:** ✅ done 2026-11-16 — `player/src/lib/time.js` (37 LOC),
  `lib/time.test.js` (**12 tests**). `timeAgo` gained an optional `now`
  parameter (the caller's reference instant) so the buckets are testable
  without freezing the clock; `settings.js` calls it with the old 1-arg form
  and behaviour is unchanged. Both accept an optional pinned `locale`.
  `settings.js` 1067 → 980 LOC: import added, both local definitions deleted.

### T-114 — `lib/capabilities.js`
- **Type:** feat · **Priority:** P0 · **Size:** S (~70 LOC)
- **Spec:** runtime capability probe (`webAPIVersion`, `AbortController`,
  `trimStart`, `ResizeObserver`, `requestVideoFrameCallback`,
  `mediaCapabilities`, `hasAvplay`, `hasShaka`). Single source of truth.
- **Acceptance:** ≥ 10 tests with a mocked `window`; every platform decision
  in the app reads from here and nowhere else.
- **Spec detail:** `docs/TIZEN_COMPAT.md` §4.
- **Status:** ✅ done 2026-11-16 — see the detailed entry under T-115. The
  probe was split into `lib/capabilities.js` (pure decisions, 24 tests) and
  `capabilities.js` (the only file that reads globals, 10 tests).

### T-115 — Route platform decisions through `capabilities.js`
- **Type:** refactor · **Priority:** P1 · **Size:** S
- **Spec:** T-114 built the single probe; this makes it the only source.
  Fold `avplay.js` `isAvailable()` and the ad-hoc `window.tizen` checks in
  `main.js`, `remote.js`, `settings.js` and `update.js` onto the probe.
- **Acceptance:** `grep -r "typeof window.webapis" player/src` appears only in
  `capabilities.js`; `avplay.js` exposes no platform detection of its own;
  the native-fallback behaviour is unchanged.
- **Depends:** T-114.
- **Notes:** behaviour risk, not a code move — `player.js` keeps `useAvplay`
  as *runtime state* (a channel may switch engine), which is not the same
  thing as a *platform capability*. Do not collapse the two: the probe says
  what is possible, the flag says what is currently in use.
- **Status:** ✅ done 2026-11-16 — **split across two files, because the plan's
  single-file version cannot pass the guard.** `TIZEN_COMPAT.md` §4 places the
  probe in `lib/capabilities.js`, but `lib/` is DOM-free by rule and the guard
  matches `/\bwindow\b/`, which `typeof window !== 'undefined'` also trips.
  So:
  - `player/src/lib/capabilities.js` (78 LOC) — **pure decisions**:
    `parseWebApiVersion`, `meetsMinimumPlatform`, `selectEngine`,
    `engineLabel`, `missingApis`, `canObserveVideoFrames`,
    `MIN_WEB_API_VERSION`.
  - `player/src/capabilities.js` (68 LOC) — **the one place that reads
    globals**: `detectCapabilities(win?)` (injectable for tests, every read
    wrapped in try/catch), plus a cached `capabilities()` and
    `currentEngine()`.
  - Tests: `lib/capabilities.test.js` (**24**) + `capabilities.test.js`
    (**10**, with a fake `window`) = **34**, against a bar of 10.
  - **Consumer wiring is NOT done.** Acceptance says every platform decision
    must read from here; today `avplay.js` has its own `isAvailable()` and
    `player.js` keeps its own `useAvplay` state. Migrating them is real
    behaviour risk with no ticket — left open deliberately, see "Next" below.
- **Status (T-115):** ✅ done 2026-11-16. `capabilities.js` is now the only
  file that reads `window.tizen` / `window.webapis` for detection. Remaining
  occurrences are API *calls* after a guard (`registerKey`,
  `getCurrentApplication`), which is correct.
  - New probe fields: `hasTvInputDevice`, `hasApplicationControl`.
  - New pure decisions: `hasTvKeyInput`, `platformName`.
  - Rewired: `avplay.isAvailable()` → `capabilities().hasAvplay`;
    `main.js` key registration + app exit; `remote.js` IME key handling;
    `settings.js` IME re-focus; `update.js` ping `tv` field.
  - **Bug found and fixed:** `hasShaka` probed `window.shaka`, but the app
    *imports* Shaka as a module and never sets that global — so it reported
    `false` on every shipped TV and `selectEngine()` would have claimed a
    working Shaka TV was native-only. Now hardcoded `true` with a regression
    test and a "do not restore" note in `TIZEN_COMPAT.md` §4.
  - **Bug found and fixed:** `settings.js` evaluated `isTizenTV` at module
    load, caching the probe before Tizen injects its globals. Now a lazy
    `onTv()` helper read at call time.
  - Tests **177 → 187**. Also honoured the format ratchet: `settings.js`,
    `avplay.js`, `remote.js` reformatted and removed from `.prettierignore`,
    which is now down to `styles.css` + `xtream.js`.

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
- **Status:** ✅ done 2026-11-16 — `player/src/player/recovery.js` (209 LOC) +
  **63 tests** across three files (`recovery.test.js` 247 LOC,
  `recovery-sequence.test.js`, `recovery-terminal.test.js`), against a bar of
  30. Total suite **196 → 243**.
  - **Shape changed from the spec, deliberately.** The spec says isolate
    `handlePlayerError` *and* `scheduleReconnect`/`giveUpTune` into one module.
    That cannot work: `recovery` would call `loadChannel` (in `load.js`) while
    `load.js` calls `scheduleReconnect` (in `recovery`) — an import cycle, and
    the guard forbids cycles. Also, those functions touch timers and DOM, so
    they could never be unit-tested in the node env.
  - **What actually landed:** `recovery.js` is a *decision-only* module. One
    pure function, `planRecovery(error, ctx)`, returns a plan
    (`none | ignore | pdt-retry | forbidden-reload | token-refresh | reload |
    reconnect | giveup | advance | terminal`) plus the counter values the
    caller must write back. `player.js` keeps every side effect and became a
    `switch` over the plan. `scheduleReconnect`/`scheduleForbiddenReload` now
    accept the delay the plan computed, so `logic.js` stays the single source
    of the backoff numbers.
  - **Counter order preserved exactly.** The original interleaved its
    increments with the branches — a 401/403 also bumps `consecutiveErrors`,
    which is what lets a later recoverable error trip the hard-reload budget.
    The plan returns counters rather than mutating, and the order mirrors the
    original line for line.
  - **Two behaviour traps caught while characterising:**
    1. `hardReloads` is incremented *then* compared, so the **third** hard
       reload is the one that gives up (`hardReloadDecision(3) === 'giveup'`),
       not the fourth. My first test asserted the opposite and the code was
       right.
    2. An auth error that exhausts its retries **falls through** to the
       terminal handler, which logs and shows the error *before* advancing. An
       early `return` would have silently dropped that reporting.
  - **One bug I introduced and caught:** `reconnectAttempts` was returned as a
    counter *and* incremented inside `scheduleReconnect()`, double-counting and
    halving the retry ladder. The plan now computes the delay from
    `ctx.reconnectAttempts + 1` and leaves the increment to the caller.
  - **`forbidden-reload` logging is conditional via a `log` field.** The plain
    retry path logged `"403 on segment — retry N/3"`; the
    refresh-without-callback fallback logged nothing. Collapsing them would
    have added a log line to a path that never had one.

### T-121 — M2 engine split (RE-SCOPED 2026-11-17)
- **Type:** refactor · **Priority:** P0 · **Size:** L — split into T-124…T-127
- **Original spec:** `init.js` = `initPlayer` + `destroyPlayer`;
  `load.js` = `loadChannel` + `reloadChannel`.
- **Why re-scoped:** the literal shape is not implementable as a pure move.
  `loadChannel` is **351 LOC** (the guard caps every new file at 300), and
  `initPlayer → handlePlayerError → loadChannel → initPlayer` is a
  **three-node import cycle** the guard forbids. Compressing all of M2 into
  one ticket, on playback code that cannot be smoke-tested on a TV, was the
  wrong unit of work. The night-shift agent blocked it on 2026-11-16 with no
  code changed and no gate run red — a correct conservative decision.
- **Status:** ✅ re-scoped — superseded by **T-124, T-125, T-126, T-127**,
  in that order. This ticket is now an umbrella; do not pick it up directly.

### T-124 — `player/deps.js` — cross-slice dependency registry
- **Type:** refactor · **Priority:** P0 · **Size:** XS (~70 LOC)
- **Spec:** create `player/src/player/deps.js` exporting a single mutable
  object of function slots that the M2 slices register into at boot:
  `loadChannel`, `initPlayer`, `handlePlayerError`, `scheduleReconnect`,
  `showError`, `logEvent`, `getErrorMessage`, `giveUpTune`,
  `probeChannelFormat`, `startStallWatchdog`, `stopStallWatchdog`,
  `startBlackWatchdog`, `stopBlackWatchdog`, `notifyBufferingProgress`,
  `isRenderingFrames`. Every function that will move to a slice calls
  through a slot; the hub registers the concrete implementations.
- **Acceptance:** pure module, no imports from other slices, no DOM at import
  time; ≥ 8 tests proving a registered slot is the one invoked and that an
  unregistered slot fails loudly (never silently no-ops). No import cycle.
- **Depends:** — · **Must land before T-125…T-127.**
- **Notes:** this is the cycle breaker. `init → handleError → load → init`
  becomes `init → deps.handleError` / `load → deps.init`, with only the hub
  importing all three. Registering a slot is one line per function in
  `player.js`, changed again when T-128 builds `player/index.js`.
- **Status:** ✅ done 2026-11-17 — `player/deps.js` added with 15 unwired slots
  that throw a named error; `deps.test.js` (13 tests) proves registration and
  fail-loud behaviour. `player.js` registers all 15 concrete functions and
  routes the `init → handleError → load → init` cycle edges through slots
  (behaviour-neutral). All gates green incl. `npm run tizen`; bundle
  968.29 → 969.37 kB (+0.11 %). No TV verification claimed.

### T-125 — Pure helpers out of `loadChannel`
- **Type:** refactor · **Priority:** P0 · **Size:** S (~120 LOC moved, ~30 new)
- **Spec:** extract DOM-free helpers from `loadChannel` into
  `lib/mime.js`/existing pure modules: `isNativeLoadCrash` (already in
  `lib/drm.js`? check before duplicating), the format-sniffing decision in
  `probeChannelFormat`, `detectMimeType`, and the counter-reset decision
  (use `logic.js` `tuneCountersReset` instead of reimplementing). Keep the
  fetch/AbortController part of `probeChannelFormat` in `player.js`.
- **Acceptance:** ≥ 15 new tests on the extracted decisions; `player.js`
  LOC drops by ≥ 80; behaviour identical (characterise first); no file > 300.
- **Depends:** T-124
- **Notes:** prerequisite to T-126 so the moved `loadChannel` fits under 300.
- **Status:** ✅ done 2026-11-17 — `lib/mime.js` (60 LOC) holds `detectMimeType`
  + `sniffMimeFromBytes` (23 new tests). `isNativeLoadCrash`/`isRecoverable`
  were already in `player/recovery.js` — verified equivalent (the `httpStatusOf`
  `null` vs `undefined` difference is unreachable at the branch), so the two
  local duplicates were deleted in favour of imports, not re-created.
  `player.js` 1487 → 1402 LOC (−85, ≥80 target). All gates green incl.
  `npm run tizen`; bundle 969.37 → 968.97 kB (−0.04 %). No TV verification claimed.

### T-126 — `player/init.js` — init + destroy slice
- **Type:** refactor · **Priority:** P0 · **Size:** M (~200 LOC)
- **Spec:** move `initPlayer` and `destroyPlayer` into
  `player/src/player/init.js`. Replace the direct `handlePlayerError` call
  with `deps.handlePlayerError`. Keep `showLoading`, `getBufferingPercent`
  and other cross-slice calls through `deps` slots. Register the two
  concrete functions in `player.js`.
- **Acceptance:** public 24-name surface unchanged; all gates green; bundle
  change within ±2 %; no import cycle; `init.js` ≤ 300 LOC.
- **Depends:** T-124, T-125 · **Must land before T-127.**
- **Status:** ✅ done 2026-11-17 — `player/init.js` (273 LOC) holds `initPlayer`,
  `destroyPlayer` and the six video-element event handlers only `initPlayer`
  uses. Four new deps slots (`showLoading`, `getBufferingPercent`,
  `showPlayState`, `toProxied`) carry the slice's calls back into the hub,
  so no slice imports `player.js` (zero cycles). Transitive surface audit
  24 before / 24 after. All gates green incl. `npm run tizen`; bundle
  968.97 → 969.36 kB (+0.04 %). No TV verification claimed.

### T-127 — `player/load.js` — load + reload slice
- **Type:** refactor · **Priority:** P0 · **Size:** M (~280 LOC, may need a
  second file `load-error.js` if the catch block pushes it over 300)
- **Spec:** move `loadChannel`, `reloadChannel` and the load-error catch
  block into `player/src/player/load.js`. Every cross-slice call
  (`deps.initPlayer`, `deps.scheduleReconnect`, `deps.showError`,
  `deps.giveUpTune`, watchdogs, `deps.probeChannelFormat`) goes through the
  registry. Self-recursion stays local. Register `loadChannel` and
  `reloadChannel` in `player.js`.
- **Acceptance:** public 24-name surface unchanged; all gates green;
  `init → handleError → load → init` resolved via registry with **zero
  import cycles**; bundle within ±2 %; every new file ≤ 300 LOC.
- **Depends:** T-126
- **Notes:** if the catch block alone exceeds 300 LOC, split it into
  `player/load-error.js` **in this same ticket** — do not defer. Both files
  must be behaviour-identical; the load-error logic already calls
  `logic.js` decisions, never reimplements them.
- **Status:** ✅ done 2026-11-17 — `player/load.js` (257 LOC) and
  `player/load-error.js` (121 LOC), both under the 300 cap (the split was
  required: `loadChannel` alone is 351 LOC). `player.js` drops to 722 LOC.
  24-name API intact; 288 tests (4 new load-error branch-order tests);
  bundle +0.13 %; zero cycles; WGT signs.
  - Nine new deps slots (incl. `destroyPlayer`) carry load's call-backs into
    the hub. `load-error.js` uses `deps.destroyPlayer` rather than importing
    `init.js` directly because Shaka needs `self`, which is absent in the
    node test env.
  - Cross-slice audit: every call is qualified through `deps`; the only bare
    `loadChannel` is same-module recursion in `load.js`. No TV verification.

### T-122 — `player/events.js` + `player/stream.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~330 LOC combined)
- **Spec:** `events.js` = the `on*` subscription callbacks; `stream.js` =
  resolutions, audio tracks, active track.
- **Acceptance:** same 24 exports; DRM path untouched.
- **Status:** ✅ done 2026-11-16 — `player/events.js` (5 subscription
  setters) and `player/stream.js` (13 track/resolution/getter functions)
  extracted verbatim. `player.js` imports the four helpers it still uses and
  re-exports all 18 moved names, so its public surface is **exactly the same
  24 names** (measured). No new module beyond the two the ticket names; no
  import cycle; bundle 963.24 kB → 963.24 kB (0 %). Full gates green including
  `npm run tizen`. DRM path (`isEmeSupported`) moved unchanged.

### T-123 — Delete `player.js`
- **Type:** refactor · **Priority:** P0 · **Size:** XS
- **Acceptance:** `player.js` gone; `player/index.js` is the only entry;
  every importer updated; full suite green.
- **Status:** ✅ done 2026-11-17 — `player.js` deleted;
  `player/index.js` is the only entry and re-exports the same 24 names via
  `export *`. Both importers updated. Remaining functions moved into six
  slices (dom, watchdog, recover, native, probe, controls), all under 300 LOC;
  each slice self-wires its deps slots. 291 tests (3 new hub-wiring tests);
  bundle +0.09 %; zero cycles; WGT signs. Modularity baseline 5 → 3 — the two
  `player.js` violations are genuinely resolved, not suppressed.
  **Previously:** ⛔ blocked 2026-11-16 — still owned `initPlayer`, `loadChannel`,
  the recovery/watchdog paths and the DOM helpers that T-121 was meant to
  extract. It cannot be deleted until **T-124 → T-127** land in order; the
  index hub cannot be the only entry while those functions live here.
  T-122 extracted only the events and stream slices.

---

## Phase 3 — `ui/` split (M3)

### T-129 — Extract `player/state.js` (shared module state)
- **Type:** refactor · **Priority:** **P0** · **Size:** S (~120 LOC)
- **Spec:** `player.js` holds ~20 module-level variables (`player`,
  `currentChannel`, `loadToken`, `reconnectTimer`, `hardReloads`,
  `segment404Url`, `pdtFallbackUrls`, `sniffedMimeUrls`, …) shared by every
  function in the file. Extract them into `player/state.js` **before** the
  file is sliced — otherwise each slice gets its own copy and the engine
  silently stops working.
- **Acceptance:** no behaviour change; the shared state is one exported
  object; the player still tunes, retries and recovers exactly as before.
- **Depends:** — · **Must land before T-120.**
- **Notes:** `docs/MIGRATION.md` §4 Risk C. Same pattern applies to `ui.js`
  (T-130) and `settings.js`.
- **Status:** ✅ done 2026-11-16 — `player/src/player/state.js` (103 LOC),
  `state.test.js` (**9 tests**). **45** bindings moved, not "~20": the ticket
  underestimated the coupling. `player.js` 1533 → 1464 LOC.
  - Renamed to `state.<name>` at **495** sites via an AST transform (acorn),
    not a regex. A regex is unsafe here: `player.js` contains a regex literal
    with quote characters in it, which desyncs any hand-written
    string/comment scanner — my first attempt silently found 0 renames
    because of exactly that.
  - `config.player` and `shaka.Player` were left untouched (property
    accesses, excluded by the transformer). Verified by re-running the
    transform's own audit plus a bare-identifier grep that returns nothing.
  - **No `resetTuneState()` helper was added, deliberately.** The five reset
    sites in `loadChannel` reset *different* subsets (lines 567–582 vs 730–734
    vs 1402–1405 vs 1437–1450), so unifying them would have changed behaviour
    while claiming to be a pure move.
  - Bundle 931.9 → 938.3 KB (**+0.69 %**), inside the plan's ±2 % criterion;
    the delta is the 495 `state.` prefixes.
  - Behaviour-neutral by construction: every expression changed only by
    prefixing an identifier that already resolved to module scope.

### T-130 — Extract `ui/state.js` (shared module state)
- **Type:** refactor · **Priority:** P0 · **Size:** S (~120 LOC)
- **Spec:** move `ui.js`'s module-level state (`channels`, `currentIndex`,
  `focusedIndex`, `virtualStart/End`, `sidebarOpen`, `isFullscreen`,
  `rightSidebarOpen`, `rightResolutions`, `rightFocus`, `rightItems`,
  `sidebarMode`, `groups`, `selectedGroup`, `groupFocusedIndex`,
  `searchQuery`, `searchResults`, `searchFocus`) into one exported state
  object that each UI module imports.
- **Acceptance:** no behavioural change. **Do not** convert to a reactive
  store here — that is T-170, a separate ticket, so a failure has one cause.
- **Must land before T-131.**
- **Notes:** the shared-state coupling is the main hazard in this phase.
  `docs/MIGRATION.md` §4 Risk C.
- **Status:** ✅ done 2026-11-16 — `player/src/ui/state.js` (44 LOC),
  `ui/state.test.js` (**5 tests**). Measured **18** shared bindings moved
  (the ticket's list + `virtualEnd`): `espree` AST audit found them declared
  only at module scope, with **290** references and no shadowing. Renamed via
  an AST transform (espree), not a regex — four bare lookalikes were left
  untouched on purpose: two object-literal `channels:` keys and the
  `dataset.virtualStart/virtualEnd` DOM properties. `ui.js` 1463 → 1456 LOC.
  Behaviour-neutral: only module-scope references were prefixed; the 25
  slice-local `let`s (dialog, OSD, right-menu audio, timers) stay in `ui.js`
  for their own tickets. Bundle 963.24 → 966.89 kB (**+0.38 %**, inside ±2 %).
  All gates green, plus `npm run tizen`. No TV verification claimed.

### T-131 — `ui/dialogs.js`
- **Type:** refactor · **Priority:** P0 · **Size:** S (~100 LOC)
- **Spec:** `isDialogOpen`, `showConfirmDialog`, `hideConfirmDialog`,
  `dialogNavigate`, `dialogSelect`.
- **Acceptance:** zero dependencies on other UI modules; confirm dialog works
  for exit, delete playlist, and update notice.
- **Status:** ✅ done 2026-11-16 — `player/src/ui/dialogs.js` (53 LOC), the
  five named functions plus the private `updateDialogFocus`, with its four
  module-local state vars. **Zero imports** — only `document`, as required.
  `ui.js` re-exports the five names; AST export audit shows **74 before / 74
  after**, none added or removed, so `ui.showConfirmDialog` callers (exit in
  `main.js`, delete playlist in `settings.js`, update notice in `main.js`)
  are untouched. `ui.js` 1456 → 1408 LOC. Bundle 966.89 → 966.90 kB.
  All gates green, plus `npm run tizen`. No TV verification claimed.

### T-132 — `ui/osd.js`
- **Type:** refactor · **Priority:** P0 · **Size:** S (~150 LOC)
- **Spec:** channel OSD, buffering pill, empty-state brand, watermark,
  play-state overlay, progress toast.
- **Acceptance:** the z-index contract from `docs/TIZEN_GUIDE.md` §6.3 holds
  (veil 30, pills 40, splash 200, modals 300).
- **Status:** ✅ done 2026-11-16 — `player/src/ui/osd.js` (209 LOC), 20
  functions (14 public + 6 private) with 8 slice-local vars. Moved channel
  OSD, buffering pill, empty-state brand, watermark/badge and tune toast;
  `ui.js` re-exports the 14 public names (AST audit 74 before / 74 after).
  The one cross-slice call is `applySidebar()` → `applyWatermark()`, handled
  by a one-way `ui.js → ui/osd.js` import (no cycle).
  - **z-index contract:** unchanged — CSS was not touched. Verified the
    values still present: veil 30 (`styles.css:436`), pills 40
    (476/544/758/779), splash 200 (815/1456), modals 300 (1630). No inline
    z-index is set in JS.
  - **"Play-state overlay" and "progress toast" are not in `ui.js`** — their
    DOM lives in `index.html` but is driven from `main.js:1121-1138` and
    `player.js:1381`. They will travel with the app/player slices (T-150+
    and T-123), not T-132. Recorded rather than invented.
  - `ui.js` 1408 → 1227 LOC. Bundle 966.90 → 966.90 kB (0 %). All gates
    green, plus `npm run tizen`. No TV verification claimed.

### T-133 — `ui/sidebar.js` + `ui/search.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~380 LOC combined)
- **Spec:** sidebar toggle, group list, group navigation, `showGroupChannels`,
  `refreshGroupVisibility`; cross-group search (`enterSearch`, `exitSearch`,
  `searchNavigate`, `searchSelect`, rendering).
- **Acceptance:** the search flow (T-037) still works, hidden groups never
  surface, Back always lands on groups.
- **Status:** ✅ done 2026-11-17 — `ui/sidebar.js` (~174 LOC, 13 public names)
  and `ui/search.js` (~160 LOC, 4 public names) extracted. Group / search code
  calls back into the channel core, so a new pure `ui/deps.js` slot registry
  (wired by `ui.js` at boot) breaks what would otherwise be a `ui.js → slice →
  ui.js` import cycle — the `player/deps.js` pattern from T-124 applied here.
  `ui.js` 1227 → 929 LOC; export audit 74 before / 74 after, zero diff. All
  gates green including `npm run tizen`; bundle +0.06 %. **No TV verification
  claimed** — search flow, hidden groups and Back-to-groups need a device check.

### T-134 — `ui/right-menu.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~250 LOC)
- **Spec:** right sidebar, resolution list, audio list, proxy toggle,
  `rightSidebarNavigateUp/Down`, `rightSidebarSelect`.
- **Acceptance:** quality selection, audio selection, reload, refresh,
  settings and proxy all reachable by remote.
- **Status:** ✅ done 2026-11-17 — `ui/right-menu.js` (297 LOC, 12 public names)
  extracted. Two more `ui/deps.js` slots (`applySidebar`, `resetInactivity`)
  carry the slice's calls back into the core, avoiding a `ui.js → slice → ui.js`
  import cycle. `ui.js` 929 → 620 LOC; export audit 74 before / 74 after, zero
  diff. All gates green including `npm run tizen`; bundle +0.01 %. The verbatim
  move was 335 LOC, so an identical repeated focus-rebuild tail became a single
  `refreshRightFocus()` helper and decorative whitespace was trimmed to fit the
  300-LOC cap — no logic changed. **No TV verification claimed** — quality,
  audio, reload and proxy remote paths need a device check.

### T-135 — `ui/core.js` + delete `ui.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~280 LOC)
- **Spec:** `init`, `renderChannelList` (virtualised), `selectChannel`,
  `navigateUp/Down`, `selectFocused`, `jumpToNumber`, `getDisplayChannels`,
  fullscreen helpers, inactivity timer.
- **Acceptance:** `ui/index.js` exports the same **74 names** as the old
  `ui.js`; a scripted checklist of remote flows passes unchanged.
- **Status:** ✅ done 2026-11-17 — `ui.js` (620 LOC at the time) split into
  `ui/core.js` (248), `ui/chrome.js` (194) and `ui/channel-view.js` (143), with
  `ui/index.js` as a pure `export *` hub. One file would have been ~580 LOC
  against the 300 cap. Transitive surface audit 74 before / 74 after, zero
  name diff — internal helpers routed through `ui/deps.js` so the hub exposes
  no extra names. `main.js` and `settings.js` import `./ui/index.js`; `ui.js`
  is gone. Baseline 7 → 5 (both `ui.js` entries resolved). All gates green
  including `npm run tizen`; bundle +0.08 %. **No TV verification claimed** —
  the scripted remote-flow checklist still needs a device.

---

## Phase 4 — `settings/` split (M4)

### T-140 — `settings/nav.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~200 LOC)
- **Spec:** `buildFocusOrder`, `applyFocus`, `clearFocus`, `navigate`,
  `navigateNav`, `selectFocused`, `moveSettingsFocus`.
- **Acceptance:** the BUG-011/012 remote paths still work — OK in the proxy
  URL field saves, OK in a playlist name field advances to the URL field, OK
  in the URL field saves.
- **Status:** ✅ done 2026-11-17 — `settings/state.js` (11 shared vars),
  `settings/deps.js` (11 slots), `settings/nav.js` (222 LOC),
  `settings/select.js` (181 LOC). `settings.js` 1082 → 698 LOC. 7 new tests
  pin the state defaults, deps contract and the BUG-011/012 field routing.
  Bundle byte-identical to before (`index.CLX2ctDt.js`, 948.7 KB).
  - `selectFocused` split into its own file in this ticket: at 188 LOC it
    would have pushed nav.js past the 300 cap. Same pattern as T-127.
  - Browser smoke test: app loads, settings opens, no new console errors. The
    pre-existing onboarding `render()` null-container error was reproduced on
    the committed baseline — unrelated to this refactor, tracked separately.
  - **Not TV-verified.** The BUG-011/012 paths are pinned by static assertions
    on the field routing, not exercised with a real remote.

### T-141 — `settings/render.js` + `settings/playlists.js`
- **Type:** refactor · **Priority:** P0 · **Size:** L (~480 LOC combined)
- **Spec:** card rendering vs. playlist CRUD.
- **Acceptance:** all playlist operations work by remote (add, edit, rename,
  delete, fetch active, M3U + Xtream types).
- **Status:** ✅ done 2026-11-17 — `settings/playlists.js` (134 LOC),
  `settings/render.js` (218 LOC), `settings/render-cards.js` (291 LOC).
  `settings.js` 698 → 56 LOC and still exports exactly the 8-name API.
  Modularity baseline 3 → 2 — the settings LOC violation is genuinely gone.
  303 tests (5 new). Browser-verified: Source/Playback/About all render,
  ArrowDown moves focus to Playback, Enter switches section, no console errors
  beyond the expected Tizen-only `$WEBAPIS` 404.
  - Three files, not the ticket's two: `render` + `renderSourceCard` together
    are 379 LOC, over the 300 cap. Cards got their own file in this ticket.
  - `NAV_ITEMS` and `MAX_PLAYLISTS` moved to `settings/state.js` so the
    slices can read them without importing the hub.
  - **Not TV-verified.** Playlist CRUD by remote still needs a device.

### T-142 — `settings/playback.js` + delete `settings.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~150 LOC)
- **Spec:** quality toggle, auto-refresh, display toggles (watermark, badge),
  groups manager.
- **Acceptance:** `settings/index.js` exports the same 8 names; toggles
  persist immediately (the BUG-011 regression must not return).
- **Status:** ✅ done 2026-11-17 — `settings/index.js` is now the entry (8
  names verified by script: init, show, openAddForm, hide, isVisible, navigate,
  navigateNav, selectFocused). `settings.js` deleted. Toggle persistence moved
  verbatim into `settings/playback.js` (49 LOC); lifecycle into
  `lifecycle.js` (57 LOC). `render.js` 218 → 179 LOC.
  303 tests, lint, format, 0 new violations; bundle +0.01 %; WGT signs.
  **M4 complete** — the settings split is finished.
  - Browser-verified: Settings opens, all tabs render, clicking the Auto
    quality toggle wrote `autoQuality: false` to `en_settings` immediately —
    the BUG-011 acceptance criterion with a real DOM, not a unit test.
  - `applyFocus` is no longer exported from nav.js (it leaked into the 8-name
    surface); select.js calls it through `deps` like the other nav helpers.
  - T-211 (onboarding null container) remains proposed and was not touched.

---

## Phase 5 — `main.js` split + app layer (M5)

### T-150 — `app/boot.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~180 LOC)
- **Spec:** `init`, splash staging (`showBootSplash`, `hideBootSplash`,
  typewriter), first-run, onboarding, What's New, `startPlayer`,
  `restoreLastSession`.
- **Acceptance:** splash staging still chains on completion callbacks (never
  fixed sleeps) — `docs/TIZEN_GUIDE.md` §7.
- **Status:** ⚠️ partial 2026-11-17 — the three splash-staging functions
  (`showBootSplash`, `startTypewriter`, `hideBootSplash") moved verbatim into
  `app/boot.js` (116 LOC) with `app/state.js` for the three shared timers.
  `main.js` 1500 → 1397 LOC. Byte-comparison confirmed all three bodies are
  identical modulo `state.` prefixes; browser check confirmed the typewriter
  completes and the splash hides via callbacks, with no new console errors.
  303 tests, all gates green, bundle +0.02 %, WGT signs.
  - **The rest of T-150 is NOT done:** `init`, `startPlayer`, first-run,
    onboarding, What's New and `restoreLastSession` still live in `main.js`.
    They are heavily entangled with remote/channel slices (the call graph has
    multiple cycles), so extracting them needs the same deps-registry treatment
    T-123 gave the player. Attempting it with a text transform produced
    cascading errors and was reverted — no broken code was committed.
  - Follow-up ticket needed: **T-150b** for the remaining boot/startup slices.

### T-150b — App boot/startup registry and remaining boot slices
- **Type:** refactor · **Priority:** P0 · **Size:** L — split into T-152a…T-152c
- **Spec:** T-150 landed only the three splash-staging functions. This ticket
  finishes it. The remaining functions still in `main.js` are `init`,
  `startPlayer`, `restoreLastSession`, first-run, onboarding and What's New.
- **Why a separate ticket:** these form cycles through the remote slice:
  `init → registerTizenKeys → handleRemoteAction → startPlayer → init`, and
  `handleRemoteAction` (301 LOC) exceeds the 300 cap. A text move produced
  cascading errors on 2026-11-17 and was reverted.
- **Status:** ✅ re-scoped 2026-11-17 into three atomic tickets, in order:

### T-152a — `app/deps.js` registry
- **Type:** refactor · **Priority:** P0 · **Size:** XS (~90 LOC)
- **Spec:** create `app/deps.js` with a slot for every cross-slice app call,
  following `player/deps.js`. Add every app-level shared variable to
  `app/state.js`. Register no implementations yet — the hub does that in T-152c.
- **Acceptance:** ≥ 10 tests (slots fail loudly when unwired, identity stable);
  no imports from other slices; no cycles; no behaviour change.
- **Depends:** T-150 · **Must land before T-152b.**
- **Status:** ✅ done 2026-11-17 — `app/deps.js` holds 38 cross-slice slots
  (boot, onboarding, What's New, startup, remote, channel/UI helpers); every
  slot throws `app deps: <name> was called before it was wired` until the hub
  registers it in T-152c. `app/state.js` now owns all 17 shared app variables
  plus `BOOT_IDLE_HOLD_MS`. `main.js` now reads/writes through `state.*` — a
  mechanical, behaviour-neutral move (no logic or ordering changed), so the
  new fields are not dead. Verified:
  328 tests (17 deps + 8 state new), lint, format, validate (0 new violations),
  build and WGT signing all green; zero imports and zero cycles in deps.js.

### T-152b — onboarding and What's New slices
- **Type:** refactor · **Priority:** P0 · **Size:** M (~260 LOC across two files)
- **Spec:** move `showFirstRun`, `showOnboarding`/`hideOnboarding`/
  `updateOnboardFocus`/`selectOnboarding`/`isOnboardingOpen` into
  `app/onboarding.js`, and `checkWhatsNew`/`showWhatsNew`/`closeWhatsNew`/
  `markVersionSeen`/`isWhatsNewOpen`/`hideBootSplashAndMaybeWhatsNew` into
  `app/whats-new.js`. Cross-slice calls through `deps`. Move `CHANGELOG`
  into `app/changelog.js` (needed by T-153).
- **Acceptance:** every file ≤ 300 LOC; onboarding and What's New verified in a
  browser; no new console errors; gates green.
- **Depends:** T-152a
- **Status:** ✅ done 2026-11-17 — `app/onboarding.js` (6 functions),
  `app/whats-new.js` (6 functions) and `app/changelog.js` (267 LOC verbatim
  data) extracted; each slice self-registers into `app/deps.js`, and `main.js`
  wires the boot/startup-owned slots it still owns. Verified: 333 tests (5 new
  changelog tests), lint, format, validate (0 new violations), build and WGT
  signing all green. Browser-smoked: fresh profile shows the onboarding modal
  and Right-arrow focus moves to Xtream; selecting it hides the modal and opens
  Settings. A returning profile with `en_last_seen_version=0.0.0` shows What's
  New (v3.2.0, 20 sections); Enter closes it and marks the version seen.
  The T-211 console error in the add-form path is pre-existing and untouched.

### T-152c — startup slice (`init`, `startPlayer`)
- **Type:** refactor · **Priority:** P0 · **Size:** M (~330 LOC, may split)
- **Spec:** move `init`, `startPlayer`, `restoreLastSession` and the channel
  refresh helpers into `app/start.js`. `handleRemoteAction` goes to T-151.
  Register all deps slots in `app/index.js` (built in T-152).
- **Acceptance:** `main.js` shrinks further; boot, resume and first-run verified
  in a browser; zero cycles; gates green.
- **Depends:** T-152b · **Must land before T-152 (hub).**
- **Status:** ✅ done 2026-11-17 — `app/start.js` (143 LOC, init + restore +
  update check), `app/shell.js` (218 LOC, startPlayer + its listener helpers),
  `app/tune.js` (161 LOC, tune + progress/badge) and `app/channels.js`
  (116 LOC, fetch/refresh/sort) extracted. All slots self-register; `main.js`
  wires only the six functions it still owns and is down to 422 LOC. Verified:
  333 tests, lint, format, validate (0 new violations), build and WGT signing
  green. Browser-smoked: fresh profile boots to the empty shell then the
  onboarding modal; focus + Xtream selection open Settings; returning profile
  resumes "Beta Sports" in the Sports group with no app-deps errors.
  `refreshChannels` stays exported from `main.js` via a re-export.

- **Type:** refactor · **Priority:** P0 · **Size:** L
- **Spec:** T-150 landed only the three splash-staging functions. This ticket
  finishes it. The remaining functions still in `main.js` are `init`,
  `startPlayer`, `restoreLastSession`, first-run (`showFirstRun`),
  onboarding (`showOnboarding`/`hideOnboarding`/`updateOnboardFocus`/
  `selectOnboarding`/`isOnboardingOpen`) and What's New (`checkWhatsNew`/
  `showWhatsNew`/`closeWhatsNew`/`markVersionSeen`/`isWhatsNewOpen`/`
  hideBootSplashAndMaybeWhatsNew`).
- **Why a separate ticket:** these functions form cycles through the remote and
  channel slices: `init → registerTizenKeys → handleRemoteAction → startPlayer →
  init`, and `handleRemoteAction` (301 LOC) also exceeds the 300 cap. A plain
  text move produced cascading errors on 2026-11-17 and was reverted.
- **Approach (decided):** create `app/deps.js` registry following `player/deps.js`
  and `settings/deps.js`; add every app-level shared variable to `app/state.js`;
  split into `app/boot.js` (init + startup), `app/onboarding.js`,
  `app/whats-new.js`, `app/remote.js` (T-151) and `app/channels.js`, each
  ≤300 LOC, each self-wiring its deps slots. Only this ticket's `app/index.js`
  (T-152) imports all slices.
- **Acceptance:** `main.js` ≤ 60 LOC (T-152 target); zero import cycles;
  all gates green; boot/resume/first-run/onboarding verified in a browser;
  every documented remote key still works (T-151).
- **Depends:** T-150 (partial) · **Must land before T-152.**
- **Status:** proposed — needs a maintainer decision on scope/order.

### T-151 — `app/remote.js`
- **Type:** refactor · **Priority:** P0 · **Size:** M (~200 LOC)
- **Spec:** `handleRemoteAction` routing, `registerTizenKeys`, `zapChannel`.
- **Acceptance:** every documented remote key works (arrows, OK, Back, digits,
  CH ±, colour keys, media keys, `R`).
- **Status:** ✅ done 2026-11-17 — `app/remote.js` (165 LOC) owns the three
  functions and self-registers them into `deps`, including the `zapChannel`
  slot that existed but was never wired. `handleRemoteAction` was 301 LOC, so
  its view-specific switches moved to `app/remote-views.js` (218 LOC); that
  file calls `deps.zapChannel(±1)` rather than importing its sibling, keeping
  the import graph one-way and zero-cycle. Modal/settings routing (onboarding,
  What's New, confirm dialog, Settings) stays in `remote.js` and reaches
  `main.js`-owned helpers through their existing deps slots. All five services
  main.js wires were kept. `main.js` is 89 LOC — the `loc:main.js` violation is
  genuinely resolved and the baseline shrunk (one violation remains,
  `logic.js` exports). 333 tests, lint, format, validate (0 new), build and WGT
  signing all green; bundle within budget. Browser-smoked: dialog dismiss,
  ArrowDown/ChannelUp zap, sidebar and right-sidebar open/close, Blue→Settings
  and Back, onboarding hide — no `app deps` or reference errors. **No TV
  verification claimed** — colour/media keys were synthetic DOM events, not
  hardware.

### T-152 — `app/index.js` + `main.js` entry
- **Type:** refactor · **Priority:** P0 · **Size:** S (~160 LOC combined)
- **Spec:** `main.js` becomes a thin entry (≤ 60 LOC). `app/index.js` wires
  subsystems.
- **Acceptance:** `main.js` ≤ 60 LOC; boot, resume, first-run, onboarding all
  verified.
- **Status:** ✅ done 2026-11-17 — `app/index.js` (96 LOC) is now the hub: it
  imports every slice for its self-registration, wires the last five slots
  (`showBootSplash`, `hideBootSplash`, `showPlayer`, `showSettingsPage`,
  `refreshProxyMenu`), applies responsive scaling and boots on DOMContentLoaded.
  `main.js` is 4 LOC (`import './app/index.js'` plus the `refreshChannels`
  re-export) — well under the 60-LOC target. No file imports `main.js`, so
  moving its body introduced no cycle. 333 tests, lint, format, validate (0 new),
  build and WGT signing all green. Browser-smoked: seeded profile resumed Alpha
  with two channels and `--tv-scale=1.35`, ArrowDown zapped to Beta, Blue opened
  Settings, Back closed it; fresh profile reached the empty shell with no
  `app deps` or reference errors. **No TV verification claimed.**

---

## Phase 6 — Modern design system (M6)

### T-160 — Design tokens
- **Type:** style · **Priority:** P0 · **Size:** M
- **Spec:** extract colour/spacing/typography/radius/shadow scales into
  `:root` custom properties in `styles/base.css`. Update the visual system
  per `docs/FRONTEND_SPEC.md`.
- **Acceptance:** no hard-coded colours left outside the token file;
  all sizes still scale via `--tv-scale`.
- **Status:** ✅ done 2026-11-17 — `styles/base.css` holds all 228 colour
  literals as tokens; `styles.css` references only `var()`, resolved back to
  identical values. All gates + tizen green, no TV claim.

### T-161 — Split `styles.css`
- **Type:** refactor · **Priority:** P0 · **Size:** M
- **Spec:** `styles.css` → `styles/{base,layout,sidebar,player,settings,library,overlays}.css`,
  imported from `base.css`.
- **Acceptance:** each file ≤ 300 LOC; visual output unchanged (screenshot
  before/after).
- **Status:** ✅ done 2026-11-17 — 10 files under `styles/`, max 293 LOC.
  All 273 rules preserved; frozen-animation browser A/B screenshots
  pixel-identical. All gates + tizen green.

### T-162 — Accessibility pass
- **Type:** feat · **Priority:** P1 · **Size:** M
- **Spec:** `aria-live="polite"` on the loading status; `role="dialog"` +
  `aria-modal="true"` on modals; focus rings on every focusable element;
  ≥ 4.5:1 contrast for body text; never rely on colour alone (add an icon to
  error/success); `prefers-reduced-motion` respected.
- **Acceptance:** every screen fully usable by remote alone; contrast audit
  passes.
- **Status:** ✅ done 2026-11-17 — aria-live on loading/buffering/progress,
  role=alert on error, aria-label on play/pause; focus ring, reduced-motion,
  contrast-raised text/accent tokens, ⚠/✓/✕ status glyphs and a new
  `npm run a11y` audit wired into `validate`. All four modals carry
  role=dialog + aria-modal. 9 contrast unit tests pass; all gates + tizen
  green. No TV connected — no playback claim.

---

## Phase 7 — State container + plugin wiring (M7)

### T-170 — `state/` store
- **Type:** refactor · **Priority:** P0 · **Size:** M (~180 LOC)
- **Spec:** `createStore` + `subscribe`. Convert `ui/state.js` (T-130) and
  `app` globals into `appState`, `uiState`, `vodState`.
- **Acceptance:** ≥ 15 tests on the store; no behaviour change.
- **Status:** ✅ done 2026-11-17 — `state/createStore.js` with 19 tests;
  `appState`/`uiState`/`vodState` exported and wired behind the unchanged
  `state` objects. All gates + tizen green; no TV connected.

### T-171 — `app/plugins.js` registry
- **Type:** feat · **Priority:** P0 · **Size:** S (~60 LOC)
- **Spec:** the feature registry. `inlineDynamicImports: true` in the Vite
  config so `import()` works under the IIFE build.
- **Acceptance:** disabling a feature removes all its UI and remote bindings
  with no other file edited.
- **Spec detail:** `docs/v4.PLAN.md` §3.3.
- **Status:** ✅ done 2026-11-17 — `app/plugins.js` owns `FEATURES`,
  `isEnabled`, route/menu helpers, `registerFeature`, and the DOM/key guards
  applied at boot and in the remote wrapper. 31 registry tests; proxy UI reads
  its visibility from the flag. `inlineDynamicImports: true` set. All gates +
  tizen green. Full migration to `features/` follows in T-172/T-173.
  No TV connected.

### T-172 — Migrate existing features to plugins
- **Type:** refactor · **Priority:** P0 · **Size:** M
- **Spec:** move `search`, proxy toggle, AVPlay fallback and the Tizen compat
  shim into `features/`.
- **Acceptance:** each feature is a self-contained module with a documented
  contract; `app/index.js` no longer knows feature internals.
- **Status:** ✅ done 2026-11-17 — `features/` holds `search`, `avplay`,
  `tizen-compat`, `proxy` and `proxy-toggle` modules with uniform `contract`
  exports. Proxy host/settings logic left `app/index.js`; Tizen key
  registration and the hardware Back key left `app/remote.js`/`start.js`;
  `avplay.js` is a re-export shim over the real `features/avplay.js`.
  `app/plugins.js` carries both the `ui`/`keys` guards and contracts/lazy
  loaders. 15 feature tests; all gates + tizen green; no TV connected.
  **Note:** search's DOM implementation stays in `ui/search.js`; full
  remote-action ownership arrives in T-173.

### T-173 — Remote-action routing via plugins
- **Type:** refactor · **Priority:** P1 · **Size:** M
- **Spec:** `handleRemoteAction` dispatches through registered routes so a
  feature can own a key without editing `app/remote.js`.
- **Acceptance:** a new remote binding is added entirely inside a feature
  module.
- **Status:** ✅ done 2026-11-17 — `dispatchRoute` added to the plugin registry
  and called at the edge of `handleRemoteAction`; `features/proxy.js` declares
  its own key/route. 5 new tests, all gates + tizen green; no TV connected.

---

## Phase 8 — VOD: movies + series (M8)

### T-180 — VOD data model + storage
- **Type:** feat · **Priority:** P0 · **Size:** M (~200 LOC)
- **Spec:** `MediaEntry` / `Episode` typedefs (`docs/v4.PLAN.md` §8.1), a
  `media-id.js` slug helper, and a `vodState` store persisted under
  `en_settings.movies`.
- **Acceptance:** ≥ 20 tests; ids are stable across reordering and re-fetch.
- **Status:** ✅ done 2026-11-17 — pure `lib/media-id.js` + `state/vod.js`
  transforms and debounced `app/vod-store.js` persistence under
  `en_settings.movies`. 37 new tests; ids stable across reorder/re-fetch.
  All gates + tizen green; no TV connected.

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

### T-153 — Release script follows the in-app changelog move
- **Type:** fix · **Priority:** **P0** · **Size:** XS (~10 LOC)
- **Spec:** `scripts/release.mjs` reads `player/src/main.js` and requires it
  to contain `version: '<base>'` (the in-app "What's New" entry). M5 empties
  `main.js` into `app/`, which would make the release abort. Move the
  in-app changelog to `player/src/app/changelog.js` and point the script at
  the new path.
- **Acceptance:** `npm run release -- X.Y.Z --dry-run` gets past the
  changelog guard with the changelog living in `app/changelog.js`.
- **Depends:** T-152 — land in the same commit so the release path is never
  broken in between.
- **Notes:** `docs/MIGRATION.md` §4 Risk A.
- **Status:** ✅ done 2026-11-17 — landed in the T-152 commit as required.
  `scripts/release.mjs` now reads `player/src/app/changelog.js` instead of the
  emptied `main.js`; the guard message names the new path. Static verification
  confirms the file contains `version: '3.2.0'` and the guard no longer reads
  `main.js`. A live `npm run release -- … --beta --dry-run` could not be run:
  the machine's deny policy blocks the release command even in dry-run mode, a
  hard stop that was not circumvented. No tag, push or key operation attempted.

### T-186 — v4 settings schema migration
- **Type:** feat · **Priority:** **P0** · **Size:** S (~60 LOC)
- **Spec:** add a `schemaVersion` field and an additive migration in
  `config.js`. v4 introduces `movies`, `favorites` and `features` keys.
- **Acceptance:** a v3-shaped `en_settings` written into `localStorage`
  loads under v4 with the new keys defaulted and **every existing key
  preserved**; running the migration twice changes nothing (idempotent);
  the `en_settings` key name is unchanged.
- **Notes:** `docs/MIGRATION.md` §4 Risk B · `docs/BRANCHING.md` §5.
- **Renumbered 2026-11-16:** this ticket was originally T-181, colliding with
  "Add media by URL / manifest" in Phase 8. Git history uses T-181 for both
  meanings; the settings migration is **T-186** from this point forward.
- **Status:** ✅ done 2026-11-17 — `config.js` exports `SCHEMA_VERSION = 4` and
  a pure `migrateSettings(input)` that adds `movies`, `favorites` and per-feature
  `features` defaults while preserving every existing key (including unknown
  future keys) and leaving the `en_settings` key name untouched. `getSettings()`
  runs it on every load and persists only when something changed. New
  `config.test.js` (9 tests) pins the exact v3→v4 path, idempotence, repair of a
  malformed `features` value, fresh-profile defaults and the legacy
  single-playlist path. 429 tests, all gates green incl. WGT signing with the
  correct certificate. No TV verification claimed.

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
- **Status:** ✅ done 2026-11-17 — `lib/ring-buffer.js` bounds `[app]` lines at
  200 and redacts URLs/tokens and email addresses on write (19 tests).
  `lib/diagnostics.js` builds a clipboard-ready block with version, TV model
  and a 40-line log tail (6 tests). `settings/about.js` extracts the About card
  out of the 297-LOC `render-cards.js` (now 263) and adds a remote-focusable
  "Copy diagnostics" button wired through a new `copyDiagnostics` settings deps
  slot. `capabilities.js` probes the Tizen model via `systeminfo` with a safe
  fallback (3 new tests). 408 tests, all gates green incl. WGT signing with the
  correct certificate. No TV verification claimed.

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
- **Status:** ✅ done 2026-11-17 — `bug_report.yml` asks for app version, TV
  model, Tizen version, playlist type, channel name, expected vs actual,
  frequency and a redacted log block; a privacy checkbox reminds users to strip
  tokens and full stream URLs. `config.yml` routes questions to Discussions.
  Both parse as valid YAML; a pointer added to `CONTRIBUTING.md` §8.

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

### T-211 — First-run onboarding crashes before settings init
- **Type:** fix · **Priority:** P1 · **Size:** XS (~30 LOC)
- **Spec:** in a fresh profile, clicking "M3U / M3U8 Playlist" or "Xtream Login"
  in the first-run "Add your source" dialog throws
  `TypeError: Cannot read properties of null (reading 'addEventListener')`
  in `settings.js` `render()`. `main.js` `selectOnboarding()` calls
  `settings.openAddForm()` directly, which calls `render()` before
  `settings.init()` has set the container DOM node. Fix the ordering (ensure
  `init()` has run, or make `openAddForm()` initialise lazily) — do not just
  add a null guard that silently drops the form.
- **Acceptance:** with an empty `localStorage`, both onboarding choices open
  the add-playlist form with no console error; the BUG-011/012 field order is
  preserved (name → URL, OK in URL saves); regression test included.
- **Depends:** — · **Found:** 2026-11-17 during T-140 browser smoke test.
- **Notes:** confirmed pre-existing by stashing all T-140 changes and
  reproducing the identical stack on the committed baseline (`89f12c5`).
  Not caused by the settings split. Browser-only: Vitest runs in node with no
  DOM, so a unit test alone will not reproduce it — use a browser check or a
  minimal DOM shim in the test.
- **Status:** proposed

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
