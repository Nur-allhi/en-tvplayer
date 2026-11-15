# Roadmap — EN TV Player

> Status legend: `proposed` (awaiting order) · `approved` · `in-progress` ·
> `done` · `deferred` (superseded by another plan).
>
> **The active plan for v4 is `docs/v4.PLAN.md`** — it supersedes the items
> below. Work items there are tracked as tickets in `docs/TICKETS.md`.

---

## v4.0.0 — the active plan

See **`docs/v4.PLAN.md`** for the full master plan: architecture, phases
(M0–M10), quality gates, risk register, and release cadence.

Summary of the goals:

| Goal | Criterion |
|------|-----------|
| Modular | every file ≤ 300 LOC, ≤ 15 exports, zero circular imports — CI-enforced |
| Modern | design tokens, ≥ 4.5:1 contrast, remote parity on every screen |
| Optimized | bundle ≤ 1.1 MB, boot ≤ 3 s, channel switch ≤ 1.5 s, zero unbounded loops |
| Extensible | a new feature = ≤ 30 LOC of wiring; removal = one registry line |
| Safe | CI gates every PR; v3.2.0 stays installable and updatable |
| Multi-modal | live TV + movies + series on one engine |

---

## Reliability (v3.x — shipped)

### 1. Backdrop logo never renders on TV — `done`
- Problem: `player/src/styles.css` uses absolute `url('/logo.svg')`, which resolves
  to `file:///logo.svg` (filesystem root) on-device. Every TV inspector log shows
  `ERR_ACCESS_DENIED` for it — the faint backdrop brand never appears.
- Evidence: `settings.js` already uses the correct relative `"logo.svg"`.
- Change: relative asset URL in CSS (`url('logo.svg')`), verify dist + WGT contain it.
- Size: XS (one line + TV sideload check).

### 2. Audit recovery counters for dead branches / unbounded loops — `done`
- Problem: `loadChannel()` resets `lastResortAttempts` on every entry, so the
  "advance after 3 failed 401/403s" branch in `handlePlayerError` looks
  unreachable; the reconnect path there has no cap either.
- Change: trace every retry/reconnect cap, prove each bound with a state-machine
  check (as done for the segment-404 budget), fix or remove dead branches.
- Size: S (audit + targeted fixes, no behavior change on happy paths).

### 3. Redact stream tokens from logs — `done`
- Problem: `logEvent` prints URL slices containing `?token=…`; users paste
  inspector logs publicly on GitHub. Against the project's privacy principle.
- Change: one `redactUrl()` helper applied at all log sites; keep last-55-chars
  debug value of request tracking (host + path, no query).
- Size: XS.

### 4. Boot playlist fetch resilience — `done`
- Problem: single 10s fetch; failure with no cache lands on a dead-end
  first-run screen, and background-refresh failures only `console.warn`.
- Change: 1–2 backoff retries on boot fetch; when a stale cache exists, show
  "using saved list from <date>" instead of stranding.
- Size: S.

## Developer velocity (v3.x — shipped)

### 5. Automated tests (start with pure logic) — `done`
- Problem: zero test runner/scripts — every fix needs manual browser + TV
  verification, and regressions have no net.
- Change: add Vitest; cover DOM-free logic first: `parseM3u`, resume matching,
  segment-404 budget, `compareVersions`, group filtering/hidden groups.
- Size: M (setup + first suite; grows incrementally per fix).
- **v4 continues this**: `docs/v4.PLAN.md` Phase 1 adds ~80 more tests.

### 6. Split oversized files toward the 300-LOC rule — `deferred` → v4
- Problem: `ui.js` (~1460), `player.js` (~1670), `main.js` (~1590),
  `styles.css` (~1770) — every recent fix touched these hot files.
- Original plan: `docs/FILE_SPLIT_PLAN.md` (Phases 1–4).
- **Superseded**: the v4 plan splits the same files, but sequenced behind a
  test-coverage phase and with a CI-enforced ratchet so the debt can only
  shrink. See `docs/v4.PLAN.md` M1–M5 and `docs/TICKETS.md` T-110…T-152.

### 7. Lint/format + dead-code removal — `done`
- Problem: no eslint/prettier anywhere; style drifts. Confirmed dead code:
  `pendingPreview` in `player/src/main.js` (declared, never used).
- Change: add eslint + prettier with pre-commit hook; delete `pendingPreview`;
  grep for other unused exports/vars while at it.
- Size: XS.

### 8. Script the release process (+ beta flow) — `done`
- Problem: 8 manual steps across 2 repos per release; the v3.2.0-beta.1 flow
  (testbuild asset naming, community-bundle blindness, version.json pinning)
  exists only in chat history.
- Change: `npm run release -- x.y.z` (+ `--beta`) covering bumps, changelog
  dating, build, WGT copies, commit/tag/push, `gh release`, community JSON;
  document the beta procedure in `AGENTS.md` §9.
- Size: M.

## UX / support load

### 9. On-device diagnostics + issue templates — `approved` (v4.1)
- Problem: every triage needs inspector logs users struggle to capture.
- Change: bounded in-memory log ring + "copy diagnostics" (version, TV model,
  recent log tail) on Settings → About; add GitHub issue templates asking for
  model/version/log.
- **Ticket:** T-200, T-203 → `docs/v4.PLAN.md` M10.

### 10. Slim the 950KB single-chunk bundle — `proposed` (v4.x+)
- Problem: the chunk-size warning fires every build; everything ships in one
  IIFE (Shaka included), blocking future lazy-loading.
- Change: `manualChunks` split (Shaka vendor vs app); measure TV parse/startup
  before/after on sideload.
- **Blocked by:** the app builds with `output.format: 'iife'`, which Rollup
  rejects for code-splitting builds. A real split needs `format: 'es'`, which
  then needs a decision about older Tizen WebViews. **Ticket:** T-305.

---

## Platform

### 11. Tizen 4.0 support — `proposed` → **ruled out**
- Original ask: support Tizen 4.0 (2015 TVs) alongside 5.0+.
- **Measured outcome:** not achievable with the current engine. Shaka Player
  5.x depends on `Proxy` (Chromium 49); Tizen 4.0 is Chromium 47, and `Proxy`
  cannot be meaningfully polyfilled. The only path would be dropping Shaka
  for the native AVPlay pipeline — which would drop ClearKey/PlayReady DRM,
  the app's headline feature.
- **Decision:** Tizen 5.0 is the supported floor. Tizen 5.0 *reliability* work
  (guarded shims for `AbortController`, `trimStart`, `ResizeObserver`, plus a
  graceful native-only fallback) is ticket T-190/T-191 in v4 Phase 9.
- **Evidence:** `docs/TIZEN_COMPAT.md` — includes the exact commands to
  re-measure if Shaka ever ships a non-`Proxy` build.

---

## Change log

| Date | Change |
|------|--------|
| 2026-11-15 | Rewritten to point at `docs/v4.PLAN.md` as the active plan. Item 6 deferred to v4 (superseded split plan). Item 9 approved → ticket T-200. Item 10 noted as blocked by the IIFE build. Item 11 added and ruled out by measurement. |
