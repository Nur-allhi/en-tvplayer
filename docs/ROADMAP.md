# Roadmap — proposed improvements

Status legend: `proposed` (awaiting order) · `approved` · `done`.
Work items in execution order once approved; one fix branch per item.

## Reliability

### 1. Backdrop logo never renders on TV — `proposed`
- Problem: `player/src/styles.css` uses absolute `url('/logo.svg')`, which resolves
  to `file:///logo.svg` (filesystem root) on-device. Every TV inspector log shows
  `ERR_ACCESS_DENIED` for it — the faint backdrop brand never appears.
- Evidence: `settings.js` already uses the correct relative `"logo.svg"`.
- Change: relative asset URL in CSS (`url('logo.svg')`), verify dist + WGT contain it.
- Size: XS (one line + TV sideload check).

### 2. Audit recovery counters for dead branches / unbounded loops — `proposed`
- Problem: `loadChannel()` resets `lastResortAttempts` on every entry, so the
  "advance after 3 failed 401/403s" branch in `handlePlayerError` looks
  unreachable; the reconnect path there has no cap either.
- Change: trace every retry/reconnect cap, prove each bound with a state-machine
  check (as done for the segment-404 budget), fix or remove dead branches.
- Size: S (audit + targeted fixes, no behavior change on happy paths).

### 3. Redact stream tokens from logs — `proposed`
- Problem: `logEvent` prints URL slices containing `?token=…`; users paste
  inspector logs publicly on GitHub. Against the project's privacy principle.
- Change: one `redactUrl()` helper applied at all log sites; keep last-55-chars
  debug value of request tracking (host + path, no query).
- Size: XS.

### 4. Boot playlist fetch resilience — `proposed`
- Problem: single 10s fetch; failure with no cache lands on a dead-end
  first-run screen, and background-refresh failures only `console.warn`.
- Change: 1–2 backoff retries on boot fetch; when a stale cache exists, show
  "using saved list from <date>" instead of stranding.
- Size: S.

## Developer velocity

### 5. Automated tests (start with pure logic) — `proposed`
- Problem: zero test runner/scripts — every fix needs manual browser + TV
  verification, and regressions have no net.
- Change: add Vitest; cover DOM-free logic first: `parseM3u`, resume matching,
  segment-404 budget, `compareVersions`, group filtering/hidden groups.
- Size: M (setup + first suite; grows incrementally per fix).

### 6. Split oversized files toward the 300-LOC rule — `proposed`
- Problem: `ui.js` (~1400), `player.js` (~1350), `main.js` (~1330),
  `styles.css` (~1770) — every recent fix touched these hot files.
- Change: incremental extractions, one per branch (e.g. `ui/sidebar.js`,
  `player/recovery.js`), no behavior change per split, build-verified each step.
- Size: M total, XS per step. Pair with the next feature touching each file.

### 7. Lint/format + dead-code removal — `proposed`
- Problem: no eslint/prettier anywhere; style drifts. Confirmed dead code:
  `pendingPreview` in `player/src/main.js` (declared, never used).
- Change: add eslint + prettier with pre-commit hook; delete `pendingPreview`;
  grep for other unused exports/vars while at it.
- Size: XS.

### 8. Script the release process (+ beta flow) — `proposed`
- Problem: 8 manual steps across 2 repos per release; the v3.2.0-beta.1 flow
  (testbuild asset naming, community-bundle blindness, version.json pinning)
  exists only in chat history.
- Change: `npm run release -- x.y.z` (+ `--beta`) covering bumps, changelog
  dating, build, WGT copies, commit/tag/push, `gh release`, community JSON;
  document the beta procedure in `AGENTS.md` §8.
- Size: M.

## UX / support load

### 9. On-device diagnostics + issue templates — `proposed`
- Problem: every triage needs inspector logs users struggle to capture.
- Change: bounded in-memory log ring + "copy diagnostics" (version, TV model,
  recent log tail) on Settings → About; add GitHub issue templates asking for
  model/version/log.
- Size: M.

### 10. Slim the 950KB single-chunk bundle — `proposed`
- Problem: the chunk-size warning fires every build; everything ships in one
  IIFE (Shaka included), blocking future lazy-loading.
- Change: `manualChunks` split (Shaka vendor vs app); measure TV parse/startup
  before/after on sideload.
- Size: S (config + measurement).
