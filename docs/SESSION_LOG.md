# SESSION LOG — EN TV Player

> **Purpose:** a handover record. Anyone picking up the repo reads the last
> entry here to learn where the work stands without reading the whole history.
> **Rule:** every working session appends one entry before it ends. A session
> that ends without an entry is treated as unfinished.
> **Append only.** Never edit or delete an earlier entry — it is the audit
> trail of how the project got here.

---

## How to write an entry

Copy the template, fill it in, append it **at the top** of the log (newest
first). Keep it short — the point is handover, not a diary.

```markdown
## YYYY-MM-DD — <what you worked on> — @<name>

**Ticket:** T-1xx
**Branch:** feature/xxx → dev
**Status:** ✅ merged · 🔄 in progress · ⛔ blocked

**What changed**
- …
- …

**Verified**
- `npm test` → N passed
- `npm run build` → ok
- Manual: <what you clicked / what you saw>

**Decisions**
- <why you chose X over Y>

**Watch out**
- <anything that will bite the next person>

**Next**
- <the obvious next step>
```

---

## Log

## 2026-11-17 — T-152c: startup slice split — @nightshift

**Ticket:** T-152c ✅ · **Branch:** `feature/t-152c-startup-slice` → `dev`
**Status:** ✅ done — BATCH_LIMIT of 3 reached; this batch ends here

**What changed**
- `app/start.js` (143 LOC) — `init`, `restoreLastSession`, update check helpers.
- `app/shell.js` (218 LOC) — `startPlayer` + the cleanup/listener helpers.
- `app/tune.js` (161 LOC) — `handleChannelSelect`, progress toast, badge helpers.
- `app/channels.js` (116 LOC) — fetch/refresh/token-recovery/sort helpers.
- Every slice self-registers into `deps`; `main.js` wires only the six
  functions it still owns (boot ×2, showPlayer, showSettingsPage,
  refreshProxyMenu, handleRemoteAction, registerTizenKeys) and calls the
  bootstrap via `deps.init()`. `main.js` 422 LOC. `refreshChannels` re-exported
  so the old `main.js` surface survives.

**Verified**
- `npm test` → 333 passed; lint, validate (0 new violations), format, build,
  `npm run tizen` all green.
- Browser (Playwright, fresh isolated context): first load reached the empty
  shell and onboarding modal; ArrowRight moved focus to Xtream; clicking it
  hid the modal and opened Settings. A seeded returning profile resumed
  "Beta Sports" in the Sports group. No `app deps` errors on either path.
- **No TV is connected.** No playback behaviour changed; no TV claim made.

**Decisions**
- Four small slices instead of one ~334 LOC `app/start.js`: the modularity cap
  is 300, and `startPlayer` plus its private listener helpers already total
  ~220 LOC, so they need their own file.
- Kept `showPlayer`, `showSettingsPage`, `refreshProxyMenu`, remote keys and
  `handleRemoteAction` in `main.js` for T-151 rather than moving them here.

**Watch out**
- The browser check caught a wiring gap ESLint cannot see: `refreshProxyMenu`
  and `showPlayer` are owned by `main.js` but called through deps from
  `shell.js`; forgetting their wires throws at boot. All app deps usages were
  then checked against the wired set (a stray `js` match is just a comment).
- T-211 (add-form null `addEventListener` on a fresh install) is still
  pre-existing and skipped; it appears when the onboarding choice opens the
  form. The Tizen `$WEBAPIS` 404 and dead test-stream errors are expected.
- `main.js` remains over 300 LOC but is baselined; T-151 removes the 301-LOC
  `handleRemoteAction`, and T-152 adds the hub.

**Next**
- T-151 — `app/remote.js` (`handleRemoteAction`, `registerTizenKeys`,
  `zapChannel`), then T-152 and T-153 in the same commit. Batch limit reached.

---

## 2026-11-17 — T-152b: onboarding + What's New slices — @nightshift

**Ticket:** T-152b ✅ · **Branch:** `feature/t-152b-onboarding-whatsnew` → `dev`
**Status:** ✅ done — 12 functions and CHANGELOG extracted, browser-smoked

**What changed**
- `app/onboarding.js` (85 LOC) — showFirstRun + the five modal/focus helpers.
- `app/whats-new.js` (~100 LOC) — the six version/modal helpers.
- `app/changelog.js` (269 LOC) — CHANGELOG copied byte-for-byte (verified by
  diff against HEAD, modulo the `export` keyword) + `changelog.test.js` (5).
- Each slice self-registers its exports into `deps` at module scope, matching
  `settings/nav.js`. `main.js` wires the four slots it still owns (the two
  boot functions plus `startPlayer` / `showSettingsPage` via hoisted wrappers)
  and calls every moved function through `deps.*`. No `main.js` ↔ slice cycle.

**Verified**
- `npm test` → 333 passed (328 before, +5); `npm run lint`, `npm run validate`
  (0 new violations), `npm run format:check`, `npm run build`, `npm run tizen`
  all green.
- Browser (Playwright, isolated context, dev server on :5174): fresh profile
  → splash hides, onboarding modal visible, ArrowRight moves `data-focused`
  from M3U to Xtream, click hides onboarding and opens Settings with the
  Xtream fields. Returning profile (`en_last_seen_version=0.0.0`, one cached
  channel) → What's New opens with `v3.2.0`, 20 sections, close button
  focused; Enter hides it and writes `3.2.0` to localStorage.
- **No TV is connected.** No playback behaviour changed; no TV claim made.

**Decisions**
- Self-registration in each slice plus hub wiring in `main.js`, rather than a
  single big wire-up: each slice owns its own slots, and `main.js` is still the
  hub until T-152, so it must register the functions only it implements.
- `deps.startPlayer` / `deps.showSettingsPage` use wrappers so the hoisted
  function declarations are looked up at call time.

**Watch out**
- The `settings-fetch-btn` null `addEventListener` error seen when the Xtream
  form opens on a fresh profile is **T-211** (pre-existing, proposed, skipped).
  The stack points at `settings/render.js:183` via `app/onboarding.js:76`, but
  the line and missing element predate this ticket — do not attribute it here.
- The What's New close button is keyboard-driven (`Enter`/`Escape`) by design;
  a mouse click alone does nothing. That is pre-existing behaviour.
- `main.js` is still ~1045 LOC (baselined). T-152c/T-152 will shrink it.

**Next**
- T-152c — `app/start.js` (`init`, `startPlayer`, `restoreLastSession`, channel
  refresh helpers), then T-151 and T-152.

---

## 2026-11-17 — T-152a: app deps registry + shared state — @nightshift

**Ticket:** T-152a ✅ · **Branch:** `feature/t-152a-app-deps-registry` → `dev`
**Status:** ✅ done — pure additive registry, no wiring, no behaviour change

**What changed**
- `app/deps.js` (new, 60 LOC) — 38 slots for every cross-slice app call mapped
  from `main.js` (boot ×2, onboarding ×6, What's New ×6, startup ×5, remote ×3,
  channel/UI helpers ×16). Unwired slots throw `app deps: <name> was called
  before it was wired`; no imports, so no cycles.
- `app/state.js` — gained the 14 remaining shared app variables (currentIndex,
  channels, selectedGroup, buffering timers, tune guard, pendingUpdate,
  onboardFocus, progressActive, lastBackTime) and `BOOT_IDLE_HOLD_MS`.
- `main.js` — the module-level `let`s became `state.*` reads/writes. Pure
  mechanical substitution, so the fields are used rather than dead.
- `app/deps.test.js` (17 tests) and `app/state.test.js` (8 tests) added.

**Verified**
- `npm test` → 328 passed (303 before, +25); `npm run lint`, `npm run validate`
  (0 new violations, 2 tracked), `npm run format:check`, `npm run build` all green.
- `npm run tizen` → WGT signed with the committed certificate fingerprint.
- No TV/browser check: no TV is connected, and the `main.js` edit is a
  variable-to-property substitution with identical expressions and ordering,
  so no playback behaviour changed. Logic paths are unchanged.

**Decisions**
- Comprehensive slot list (38) over the minimal 4-slot variant seen mid-session:
  the ticket says "a slot for every cross-slice app call", and the full list
  matches `player/deps.js`'s approach. Future slices (T-152b/c, T-151) add no
  slots; they only wire existing ones.

**Watch out**
- All slots are intentionally unwired. Until `app/index.js` (T-152) registers
  them, calling any slot throws by design. Do not "fix" that.
- `main.js` still imports `app/boot.js` directly — T-152c/T-152 convert that to
  deps slots. `handleRemoteAction` is still 301 LOC (T-151 may split it).
- Mid-session, `deps.js`/`state.js` briefly appeared in an alternate 4-slot form
  from another writer; the final tree was re-read and verified before commit.
  If a duplicate night-shift run is scheduled, that is the likely cause.

**Next**
- T-152b — onboarding + What's New slices, using these slots; then T-152c → T-151.

---

## 2026-11-17 — T-150 partial: splash slice landed, rest re-scoped — @maintainer

**Ticket:** T-150 ⚠️ partial · **Branch:** `refactor/t-150-app-boot` → `dev`

**What changed**
- `app/state.js` — one shared object for the three boot timers.
- `app/boot.js` (116 LOC) — `showBootSplash`, `startTypewriter`,
  `hideBootSplash` moved verbatim; the boot constants they use.
- `main.js` 1500 → 1397 LOC, importing the three functions.

**Verified**
- A byte-comparison script confirmed all three function bodies are identical to
  HEAD modulo `state.` prefixes. 303 tests, lint, format, 0 new violations;
  bundle +0.02 %; WGT signs.
- Browser check: on a fresh profile the splash appears, the typewriter writes
  "Smart IPTV Player for Samsung TV", and the splash hides itself. That is the
  callback-chain acceptance (no fixed sleeps) with a real DOM. Only the
  expected Tizen `$WEBAPIS` 404 in console.

**Why partial, not full**
T-150 also names `init`, `startPlayer`, first-run, onboarding, What's New and
`restoreLastSession`. Those form a call graph with cycles through remote and
channel functions (`init → handleRemoteAction → startPlayer → init`). A scripted
text transform produced cascading parse/undefined errors; I reverted everything
rather than commit broken code. This is the same class of problem T-121 hit and
needs the same solution: an `app/deps.js` registry built deliberately, not a
regex move. Needs a new ticket (T-150b) and a human decision on ordering.

**Watch out**
- `main.js` is still baselined at >300 LOC. T-152 was going to clear it; it
  cannot until the rest of T-150 and T-151 land.
- Machine-side: night shift disabled, dev servers stopped.

**Next**
- Create T-150b with the registry design, or reconsider the M5 order.
- T-211 (onboarding crash) remains proposed and untouched.

---

## 2026-11-17 — T-142: settings.js deleted, M4 complete — @maintainer

**Ticket:** T-142 ✅ · **Branch:** `refactor/t-142-settings-playback` → `dev`
**Status:** ✅ done — settings/index.js is the entry, 8 names preserved

**What changed**
- **`settings/playback.js` (49 LOC)** — the toggle click handler moved
  verbatim out of `render()`, including every saveSettings call and the
  group-hidden logic. This is the BUG-011 surface.
- **`settings/lifecycle.js` (57 LOC)** — init, show, openAddForm, hide,
  isVisible, plus the deps wiring that used to live in settings.js.
- **`settings/index.js`** — pure `export *` hub over nav, select and lifecycle.
- **`settings.js` deleted.** Both importers updated to `./settings/index.js`.
- `render.js` 218 → 179 LOC (the toggle block left it).
- `applyFocus` is no longer a public export: select.js now calls it through
  `deps`. The public surface is exactly 8 names, checked by script.

**Verified**
- 303 tests, lint, format, 0 new violations, 72 files, WGT signs.
- Bundle 951.6 → 951.7 kB (**+0.01 %**) — effectively unchanged.
- **Browser-verified the acceptance criterion:** opened Playback, clicked the
  Auto quality toggle, and `en_settings.autoQuality` changed to `false` in
  localStorage. That is the BUG-011 regression path with a real DOM.

**Watch out**
- The modularity baseline is still 2, but neither is settings-related:
  `main.js` LOC and `logic.js` exports are M5 work (T-150/T-152).
- T-211 (first-run onboarding crash) stays proposed and untouched.
- The WGT name carries the previous commit hash; it only proves signing.

**Next**
- **M5 — app layer**: T-150 (`app/boot.js`), then T-151, T-152, T-153.
  T-152 empties `main.js` and clears the last LOC baseline violation; T-153
  must land in the same commit to keep the release script working (Risk A).

---

## 2026-11-17 — T-141: settings split nearly complete — @maintainer

**Ticket:** T-141 ✅ · **Branch:** `refactor/t-141-settings-render` → `dev`
**Status:** ✅ done — settings.js down to 56 LOC, baseline 3 → 2

**What changed**
- **`settings/playlists.js` (134)** — saveAddPlaylist, saveEditPlaylist,
  valOf, setFormType, testXtreamLogin, handleFetch.
- **`settings/render.js` (218)** — the render orchestrator.
- **`settings/render-cards.js` (291)** — the four card renderers plus group
  helpers. Needed because render + renderSourceCard together are 379 LOC.
- **`settings/state.js`** also owns `NAV_ITEMS` and `MAX_PLAYLISTS` now.
- **`settings.js`** 698 → 56 LOC, still exporting exactly the 8-name API.

**Verified**
- 303 tests (5 new), lint, format, 0 new violations, 69 files.
- Bundle 948.7 → 951.6 kB (+0.31 %), WGT signs.
- **Browser smoke test was essential again.** It caught
  `deps.renderSourceCard is not a function`: my converter had routed the
  three card renderers through deps slots that did not exist. Fixed by
  importing them directly from `render-cards.js` (no cycle — that file does
  not import render.js). ESLint passed while the page was broken.
- Real interaction verified: Source/Playback/About all render; ArrowDown moves
  focus to Playback; Enter switches section; no new console errors.

**Decisions**
- Direct imports for the three card renderers rather than three more deps
  slots: they form a one-way edge (render → cards), so a registry adds no value
  and three more slots would need wiring and tests for nothing.

**Watch out**
- Playlist CRUD was exercised by rendering only, not by a real remote.
  T-211 (first-run onboarding crash) remains proposed and is unaffected here.
- Machine-side: night shift still disabled, dev servers stopped.

**Next**
- **T-142** — `settings/playback.js` and delete `settings.js`. This clears
  the last settings LOC baseline violation and completes the settings split.

---

## 2026-11-17 — T-211 opened for the first-run crash — @maintainer

**Ticket:** T-211 (proposed) · **Found during:** T-140 browser smoke test

A fresh profile clicking "M3U / M3U8 Playlist" throws
`Cannot read properties of null (reading 'addEventListener')` in `render()`.
Reproduced on the untouched baseline, so it predates T-140. Opened as a
ticket with the full stack, the reproduction steps and the acceptance that
the fix must preserve BUG-011/012 field order — not just null-guard the crash.
Marked `proposed` in `docs/AUTONOMY.md` so an unattended run will not pick
it up without a decision.

---

## 2026-11-17 — T-140: settings navigation slice — @maintainer

**Ticket:** T-140 ✅ · **Branch:** `refactor/t-140-settings-nav` → `dev`
**Status:** ✅ done — settings 1082 → 698 LOC, navigation isolated

**What changed**
- **`settings/state.js`** — the 11 module-level vars in one object (Risk C).
- **`settings/deps.js`** — 11 slots, including nav helpers that other settings
  functions still call. Unwired slots throw loudly.
- **`settings/nav.js` (222 LOC)** — navigate, navigateNav, moveSettingsFocus,
  buildFocusOrder, clearFocus, applyFocus.
- **`settings/select.js` (181 LOC)** — selectFocused. Split from nav.js in
  this same ticket: at 188 LOC it would have pushed nav.js past 300.
- **`settings.js`** now imports/re-exports the slices, wires deps to its local
  render/playlist functions, and keeps the remaining form/rendering code.

**Verified**
- 298 tests (7 new), lint, format, 0 new violations, 66 files.
- Bundle **byte-identical**: `index.CLX2ctDt.js` at 948.7 KB — no change at all.
- Browser smoke test: app loads, settings opens, no new console error. I exercised
  the first-run M3U button and inspected the DOM.

**A pre-existing bug I confirmed, did not cause, and did not fix**
Clicking "M3U / M3U8 Playlist" in first-run onboarding throws
`Cannot read properties of null (reading 'addEventListener')` in `render()`.
I stashed all T-140 changes, reloaded the committed baseline, and reproduced
the **exact same error** (same stack, different line number). It is an
onboarding-order bug: `openAddForm()` calls `render()` before `init()` has set
the container. Out of scope for a pure refactor — worth its own ticket.

**Watch out**
- The acceptance is about remote control paths (BUG-011/012). With no TV, those
  are pinned by static assertions on field routing in `nav.test.js`, not by a
  real remote. Hardware verification is still owed.
- The browser caught a real mistake during this work: `applyFocus` was not
  exported from `nav.js`, so the page failed to load. ESLint did not catch it
  because both files were in the same lint run. Browser smoke tests earn their
  keep — keep doing them after DOM-coupled refactors.
- `settings/deps.js` has 11 slots across two wiring sites (`settings.js` and
  `nav.js`). `nav.test.js` checks both.

**Next**
- **T-141** — split `settings/render.js` + `settings/playlists.js`. This is
  the largest remaining settings ticket (~480 LOC) and will shrink
  `settings.js` below 300, clearing the last settings LOC baseline violation.
- Consider a ticket for the onboarding `render()` null-container error.

---

## 2026-11-17 — T-123: the M2 hub lands, player.js deleted — @maintainer

**Ticket:** T-123 ✅ · **Branch:** `refactor/t-123-index-hub` → `dev`
**Status:** ✅ done — **Milestone 2 complete**

**What changed**
- **`player/src/player.js` deleted.** `player/index.js` is the only entry;
  both importers (`main.js`, `settings.js`) now use `./player/index.js`.
- Six new slices under 300 LOC each: `dom.js`, `watchdog.js`, `recover.js`,
  `native.js`, `probe.js`, `controls.js`. The remaining functions moved
  verbatim; cross-slice calls go through `deps` slots.
- **Every slice self-wires its own deps slots.** `index.js` is therefore a
  pure `export *` hub, which is the shape `npm run validate` recognises as
  legitimate. It exports exactly the 24 public names — verified by script.
- `init.js` no longer exports `destroyPlayer`/`notifyBufferingProgress`:
  they are internal, used only through deps. That keeps the hub's surface at 24.
- **Modularity baseline 7 → 3.** The `player.js` LOC and exports violations
  are genuinely gone (file deleted), not suppressed. `--update` run.

**Verified**
- 291 tests (3 new hub-wiring tests), lint clean, format clean, zero cycles.
- Bundle 947.8 → 948.7 kB (**+0.09 %**), WGT signs (472.1 KB).
- A static audit confirms all **31 deps slots are wired exactly once** and
  every wiring slice is reachable from the hub. A runtime test of the hub was
  impossible in node because `init.js` imports Shaka, which needs `self`.

**Decisions**
- **Pure hub via `export *`** rather than named re-exports: the validator
  exempts a zero-own-export hub and still resolves/checks surface at the
  owning slices. Named re-exports would have looked like 24 own exports on
  the hub and tripped the 15-export rule.
- **Self-wiring slices** instead of a central Object.assign: it keeps the hub
  pure and means adding a slice cannot forget to wire its slots elsewhere.

**Watch out**
- Deleting `player.js` means the old import path is gone. Any external tool
  or snippet still importing `./player.js` will break — grep showed only the
  two updated importers in this repo.
- The WGT name still carries the last commit hash (`745a24c`), not this work.
  It only proves signing works.
- No TV attached. All of M2 owes a hardware smoke test.

**Next**
- M2 is done. Queue **NEXT = T-140** (settings split), then app layer, design
  system, state store, VOD, Tizen 5.0 compatibility.
- The scheduled task remains disabled at the maintainer's request.

---

## 2026-11-17 — T-127: the last hard M2 slice, done manually — @maintainer

**Ticket:** T-127 ✅ · **Branch:** `refactor/t-127-player-load` → `dev`
**Status:** ✅ done — M2's engine split is complete; T-123 can now build the hub

**What changed**
- **`player/load.js` (257 LOC)** — `loadChannel` + `reloadChannel`, moved
  verbatim from `player.js`. Cross-slice calls go through `deps` slots.
- **`player/load-error.js` (121 LOC)** — the catch block, split into its own
  file in the same ticket because `loadChannel` alone is 351 LOC and the
  guard caps files at 300. `handleLoadError(error, myToken, channel)` keeps
  the original branch order exactly.
- **`player.js`** 1063 → 722 LOC. Imports and re-exports `loadChannel` /
  `reloadChannel`; the 24-name public surface is unchanged (verified by script).
- **`player/deps.js`** — nine new slots, including `destroyPlayer`.
- **4 new tests** pin the load-error branch order.

**Why the split looks different from the ticket**
The ticket allowed `load-error.js` "if the catch block pushes it over 300" —
it did. The extracted handler imports `deps.destroyPlayer` instead of
`init.js` directly: `init.js` imports Shaka, which needs `self` and breaks
the node test env. Going through the registry keeps the slice testable and
preserves the no-cycle rule.

**Verified**
- 288 tests (was 284), lint clean, 54 files / 0 new violations, format clean.
- Bundle 946.6 → 947.8 kB (**+0.13 %**) against the pre-change tree — inside ±2 %.
- `npm run tizen` signs successfully (471.7 KB WGT).
- Export count script: **24 names**, identical set to before.
- Cross-slice audit: every call in `load.js`/`load-error.js`/`init.js` is
  qualified through `deps`; the only bare `loadChannel` is same-module
  recursion. No TV verification claimed.

**Watch out**
- `deps` now has 28 slots. A missing registration throws loudly (unwired
  slots are functions that throw), so a forgotten wire-up cannot silently
  degrade playback — but it will surface at runtime, not at build time.
- The night-shift task is **disabled** at the maintainer's request. This
  ticket was done manually; the queue still shows it as merged.
- No TV attached. The load/retry/recovery path owes a hardware smoke test.

**Next**
- **T-123** — delete `player.js`, create `player/index.js` as the re-export
  hub that registers every `deps` slot. Now unblocked.
- Re-enable the scheduled task when the maintainer wants autonomy back.

---

## 2026-11-17 — T-126: extract the player init slice — @nightshift

**Ticket:** T-126
**Branch:** `feature/t-126-init-slice` → `dev`
**Status:** ✅ merged · gated — no TV verification claimed

**What changed**
- `player/src/player/init.js` (new, 273 LOC) — `initPlayer`, `destroyPlayer`
  and the six video-element event handlers (`notifyBufferingProgress`,
  `onPlay`, `onPause`, `onVideoError`, `onVideoStalled`, `onVideoWaiting`)
  that only `initPlayer` attaches. Cross-slice calls now go through deps.
- `player/deps.js` + `deps.test.js` — four new slots (`showLoading`,
  `getBufferingPercent`, `showPlayState`, `toProxied`); the test's slot list
  was updated to match.
- `player.js` 1402 → 1148 LOC — imports the moved functions, re-exports
  `initPlayer` (surface stays 24), registers the four new slots.

**Verified**
- Transitive export-surface audit mirroring the validator: **24 before /
  24 after**, zero name diff.
- `npm test` → 284 passed; `npm run lint`, `npm run validate` (51 files, 0 new
  violations), `npm run format:check`, `npm run build` and `npm run tizen`
  all green.
- Bundle 968 971 → 969 355 B (+0.04 %), inside ±2 %.

**Decisions**
- Moved the six event handlers with `initPlayer` rather than leaving them in
  the hub: they have no other callers, so this keeps them beside the attach
  code and avoids six more deps slots. Only four slots were needed instead.
- `getBufferingPercent` could have been a direct import (stream.js is a leaf),
  but the ticket names it as a deps slot, so it is registered through the hub
  for a single integration point.
- `format:check` failed once on the new file (one long `deps.logEvent` line);
  fixed with `npx prettier --write player/src/player/init.js`, then all six
  gates re-run green.

**Watch out**
- `init.js` has 273 LOC — close to the 300 cap. Further additions there need a
  second slice or they trip the guard.
- The six handlers are now module-local to `init.js`; `player.js` no longer
  exports them. Any future direct call must go through a deps slot.
- No TV connected. No TV verification claimed — attach/teardown is playback
  code.

**Next**
- T-127 — extract `loadChannel` + `reloadChannel` into `player/load.js`
  (this batch's limit of 3 is reached; next batch starts here).

---

## 2026-11-17 — T-125: pure helpers out of loadChannel — @nightshift

**Ticket:** T-125
**Branch:** `feature/t-125-load-helpers` → `dev`
**Status:** ✅ merged · gated — no TV verification claimed

**What changed**
- `player/src/lib/mime.js` (new, 60 LOC) — `detectMimeType(url)` and
  `sniffMimeFromBytes(bytes)`, the two DOM-free MIME decisions formerly inline
  in `player.js`. The fetch/AbortController part of `probeChannelFormat` stays
  in `player.js`; only the byte-decision moved.
- `player/src/lib/mime.test.js` (new, 23 tests) — characterises URL extension
  hints, numeric-path detection, ftyp/HLS/DASH/TS byte sniffing and all null
  cases.
- `player.js` — imports the two mime helpers; deleted the local
  `detectMimeType` and the inline sniff block (now `sniffMimeFromBytes(bytes)`).

**Verified**
- `npm test` → 284 passed (was 261, +23); `npm run lint`, `npm run validate`
  (50 files, 0 new violations), `npm run format:check`, `npm run build` and
  `npm run tizen` all green.
- `player.js` 1487 → 1402 LOC (−85, ≥80 target met).
- Bundle 969 370 → 968 971 B (−0.04 %).

**Decisions**
- The ticket guessed `isNativeLoadCrash` might be in `lib/drm.js`; it is actually
  already in `player/recovery.js` alongside `isRecoverable`, both with existing
  tests. Verified equivalence (recovery's `httpStatusOf` yields `null` where the
  local copy yielded `undefined`; both falsy at the same branch), then deleted
  the two local duplicates in favour of imports — no new module, no reimplementation.
- The counter-reset decision already used `logic.js` `tuneCountersReset` at the
  channel-switch site; nothing to reimplement there.

**Watch out**
- `sniffMimeFromBytes` must keep the `head.includes('#EXT-X-')` check on the raw
  (untrimmed) head — the original used raw `head` there, trimmed only for the
  `startsWith` checks. The tests pin this.
- No TV connected. No TV verification claimed — the probe path is playback code.

**Next**
- T-126 — extract `initPlayer` + `destroyPlayer` into `player/init.js`.

---

## 2026-11-17 — T-124: player deps registry — @nightshift

**Ticket:** T-124
**Branch:** `feature/t-124-deps-registry` → `dev`
**Status:** ✅ merged · gated — no TV verification claimed

**What changed**
- `player/src/player/deps.js` (new) — 15 unwired function slots for the M2
  split. Pure module, no imports, no DOM; an unwired slot throws a named error.
- `player/src/player/deps.test.js` (new, 13 tests) — a registered slot is the
  function invoked, args/returns pass through, last registration wins, slots
  are independent, and every unwired slot throws.
- `player/src/player.js` — imports the registry, registers all 15 concrete
  functions at module load, and routes the three-node cycle edges through
  slots: init → `deps.handlePlayerError`, handleError → `deps.loadChannel`
  (5 sites), load → `deps.initPlayer` (2 sites).

**Verified**
- `npm test` → 261 passed (was 248, +13); `npm run lint`, `npm run validate`
  (48 files, 0 new violations), `npm run format:check`, `npm run build` and
  `npm run tizen` all green.
- Bundle 968 293 → 969 370 B (+0.11 %), inside ±2 %.

**Decisions**
- Scoped T-124 to the cycle-breaking edges only. The other 12 slots are
  registered for T-126/T-127 to consume as those slices move — the ticket's
  preparatory-registry design. Routing every call now would be a large,
  untestable change to playback code for no acceptance benefit.
- `Object.assign(deps, {...})` relies on function-declaration hoisting; all 15
  targets are declarations, so registering at module top is safe.

**Watch out**
- Registration happens once at `player.js` module load. Any future slice
  imported directly (bypassing the hub) sees unwired slots and throws —
  intended, but keep the hub as the only registration point.
- No TV connected. No TV verification claimed — the routed calls are the live
  tune/recovery paths.

**Next**
- T-125 — extract DOM-free helpers from `loadChannel`.

---

## 2026-11-17 — T-135: extract core, delete ui.js — @nightshift

**Ticket:** T-135
**Branch:** `feature/t-135-core-hub` → `dev`
**Status:** ✅ merged · gated — no TV verification claimed

**What changed**
- `player/src/ui/core.js` (248 LOC) — init, virtualised channel list,
  navigation and selection (9 public names).
- `player/src/ui/chrome.js` (194 LOC) — sidebar toggle, fullscreen, cursor and
  inactivity timer (12 public names).
- `player/src/ui/channel-view.js` (143 LOC) — channel getters/refresh, focus and
  marquee (5 public names).
- `player/src/ui/index.js` — pure `export *` hub with exactly the old 74-name
  API. `player/src/ui.js` deleted; `main.js` and `settings.js` now import
  `./ui/index.js`.
- `player/src/ui/deps.js` — more slots for internal view/watermark helpers so
  no private function leaks into the hub's `export *` surface.
- `scripts/modularity-baseline.json` 7 → 5: the `ui.js` LOC and exports entries
  are resolved (AGENTS.md §11.7).

**Verified**
- Transitive surface audit mirroring the validator: **74 before / 74 after**,
  zero name diff. The first attempt exposed 78; the 4 internal helpers were
  routed through deps until it matched exactly.
- `npm test` → 248 passed; `npm run lint`, `npm run validate` (46 files, 0 new
  violations), `npm run format:check`, `npm run build` and `npm run tizen` all
  green.
- Bundle 967 539 → 968 293 B (+0.08 %).

**Decisions**
- `export *` hub, not named re-exports: the guard counts a named-reexport hub
  as 74 own exports and would flag it as a new violation. Each slice wires its
  own deps slots locally, so the hub stays declaration-free.
- Split the remaining 620 LOC into three slices — one `core.js` would be ~580
  LOC against the 300 cap. The ticket's "~280 LOC" estimate covered only part
  of what `ui.js` still owned.

**Watch out**
- The 74-name surface is now assembled from eight modules; adding a public
  function to any slice silently grows it. Re-run the surface audit after UI
  edits.
- `deps.js` has 12 slots, all wired by slice module bodies. A direct import of
  a slice that bypasses `ui/index.js` leaves them unwired and throws — intended.
- No TV connected. No TV verification claimed — the whole UI flow needs a
  device check before v4 is called ready.

**Next**
- Batch limit (3) reached. Next batch starts at **T-124** (`player/deps.js`).

---

## 2026-11-17 — T-134: extract the right-menu slice — @nightshift

**Ticket:** T-134
**Branch:** `feature/t-134-right-menu` → `dev`
**Status:** ✅ merged · gated — no TV verification claimed

**What changed**
- `player/src/ui/right-menu.js` (new, 297 LOC) — right sidebar, resolution /
  audio dropdowns, proxy + action buttons, focus list and selection. 12 public
  names.
- `player/src/ui/deps.js` — two more slots (`applySidebar`, `resetInactivity`)
  for the slice's calls back into the core.
- `player/src/ui.js` 929 → 620 LOC — imports `applyRightSidebar` (its only
  remaining call into the slice), wires the new slots, re-exports all 12 names.

**Verified**
- Export-surface audit: 74 before / 74 after, zero diff.
- `npm test` → 248 passed; `npm run lint`, `npm run validate` (43 files, 0 new
  violations), `npm run format:check`, `npm run build` and `npm run tizen` all
  green.
- Bundle 967 440 → 967 539 B (+0.01 %), well inside ±2 %.

**Decisions**
- Same deps registry as T-133: `ui.js` must re-export the slice, so a slice
  importing `ui.js` back would be a cycle. Only two core callbacks are needed
  here (`applySidebar`, `resetInactivity`).
- The verbatim move was 335 LOC, over the 300 cap. Four setters shared an
  identical "rebuild focus if open" tail, so it became one `refreshRightFocus()`
  helper (same call order); decorative comments and interior blank lines were
  trimmed to land at 297. No logic changed.

**Watch out**
- `right-menu.js` is dense (blanks trimmed to fit the cap). Prettier keeps the
  current layout and will not restore spacing on its own — reformat if the file
  is edited further.
- `setAutoCloseCallback` stayed in `ui.js`: it writes the core
  `autoCloseCallback` var used by `autoCloseOverlays`, so moving it would need
  another slot.
- No TV connected. No TV verification claimed — quality, audio and proxy remote
  paths still need a device check.

**Next**
- T-135 (`ui/core.js` + delete `ui.js`) — the last UI slice.

---

## 2026-11-17 — T-133: extract sidebar + search slices — @nightshift

**Ticket:** T-133
**Branch:** `feature/t-133-sidebar-search` → `dev`
**Status:** ✅ merged · gated — no TV verification claimed

**What changed**
- `player/src/ui/sidebar.js` (new, ~174 LOC) — `extractGroups`, group list +
  focus/navigation, `showGroupChannels`, `showGroupList`,
  `refreshGroupVisibility` and the four sidebar getters.
- `player/src/ui/search.js` (new, ~160 LOC) — cross-group search:
  `enterSearch`, `exitSearch`, `searchNavigate`, `searchSelect` plus private
  render helpers. Exports `computeSearchResults` / `renderSearchResults` for
  `refreshGroupVisibility`.
- `player/src/ui/deps.js` (new, 20 LOC) — pure, import-free slot registry for
  the cross-slice calls (`renderChannelList`, `updateFocus`, `selectChannel`,
  `renderGroupList`, `updateSidebarTitle`), wired by `ui.js` at boot. An
  unwired slot throws loudly instead of no-op'ing.
- `player/src/ui.js` 1227 → 929 LOC — imports the sidebar functions it still
  calls, wires the deps slots, and re-exports all 17 moved public names.

**Verified**
- Export-surface audit (same logic as the validator): **74 before / 74 after**,
  zero diff.
- `npm test` → 248 passed; `npm run lint`, `npm run validate` (42 files, 0 new
  violations, no import cycle), `npm run format:check`, `npm run build` and
  `npm run tizen` all green.
- Bundle 966.90 → 967.44 kB (**+0.06 %**, inside the ±2 % criterion).

**Decisions**
- Registry over merging the slices or pulling `core.js` forward. `ui.js` must
  re-export the slices, so a slice importing `ui.js` back would be a cycle the
  guard forbids — the same problem T-124 solved for `player/`. `search.js`
  reaches `renderGroupList` / `updateSidebarTitle` through slots, so the two
  new slices never import each other either.
- No DOM unit tests added: the flow is DOM-coupled, so characterisation is the
  74-name audit plus the full gate set, matching T-130…T-132.

**Watch out**
- Deps are wired at `ui.js` module evaluation. A future direct importer of a
  slice that calls a slot before `ui.js` loads will throw — intended, fail loud.
- T-134 moves the right menu; its functions call `applySidebar` and inactivity
  helpers that stay in `ui.js`, so it needs the same registry treatment.
- No TV connected. No TV verification claimed — the hardware check of search,
  sidebar navigation and Back-to-groups is still owed.

**Next**
- T-134 (`ui/right-menu.js`), then T-135 (`ui/core.js` + delete `ui.js`).

---

## 2026-11-17 — TV verification deferred — @maintainer

**Decision:** hardware verification is postponed. T-130, T-131 and T-132 are
merged and gated, but no TV is attached to this machine, so they stay
effectively `needs-tv`. Same for T-184, T-185, T-190 and T-191.

**What changed**
- `docs/TICKETS.md` — a "Deferred TV test" note under the ticket-state table
  names every affected ticket and tells agents not to claim hardware
  verification. Search the session log for "No TV verification claimed".

**Why**
The maintainer chose to test later. Nothing on this machine can exercise
remote input, playback or the soft keyboard, so an agent asserting hardware
verification would be fabricating it. The note makes the gap discoverable.

**Watch out**
- Deferred is not waived. Before calling v4.0.0 ready, sideload a WGT and
  check channel navigation, sidebar, confirm dialog, OSD, playback, and the
  Tizen 5.0 shims (T-190).
- The nightly run continues unchanged at 23:35 Dhaka, NEXT = T-133.

---

## 2026-11-17 — T-121 re-scoped into four atomic tickets — @maintainer

**Ticket:** T-121 (umbrella) → **T-124, T-125, T-126, T-127**
**Branch:** `docs/rescope-t121` → `dev`
**Status:** ✅ done — the M2 blocker now has an implementable path

**What changed**
- **`docs/TICKETS.md`** — T-121 is now an umbrella: "do not pick up directly".
  Four new tickets replace it, in strict order:
  - **T-124** `player/deps.js` — a registry of function slots. The cycle
    breaker: slices call `deps.handlePlayerError` / `deps.initPlayer` instead
    of importing each other; only the hub imports all slices.
  - **T-125** — move DOM-free helpers out of `loadChannel` (351 LOC → under 300).
  - **T-126** — `player/init.js` (`initPlayer` + `destroyPlayer`).
  - **T-127** — `player/load.js` (`loadChannel` + `reloadChannel`), with
    `load-error.js` in the same ticket if the catch block overflows.
- **T-123** now depends on T-127; its blocked status explains why.
- **`docs/AUTONOMY.md`** — queue rewritten cleanly (42 rows, no duplicates,
  sequential order numbers), M2 note added explaining the four-ticket order.

**Why this shape**
The agent blocked T-121 on 2026-11-16 for two hard reasons: `loadChannel` is
351 LOC against a 300 cap, and `initPlayer → handlePlayerError → loadChannel →
initPlayer` is a three-node import cycle. Both are real. Compressing all of
M2 into one ticket, on playback code with no TV verification, was the wrong
unit of work. The registry makes the cycle a boot-time wire-up; the helper
extraction makes the moved function fit the guard.

**Decisions**
- **Registry over parameter threading.** Passing six hooks through every call
  would touch far more code than a single mutable slot object, with the same
  testability. The registry is pure, DOM-free and unit-testable.
- **No reordering.** T-124 must land first; T-125 makes T-127 possible; T-123
  is last. Each acceptance criterion depends on the previous ticket.
- **Kept tonight's `NEXT = T-133` untouched.** The re-scope adds tickets after
  the in-flight UI slices, so the 23:35 run is unaffected.

**Verified**
- Queue has no duplicate ticket IDs and all order numbers are sequential.
- No code was changed — no gate could be run red.
- Gates on `dev` still green: 248 tests, lint, validate, format.

**Watch out**
- The registry must register its concrete functions in `player.js` today and
  in `player/index.js` when T-123 lands. Forgetting that is a silent no-op.
- `player.js` is still baselined in `scripts/modularity-baseline.json`;
  shrinking it does not remove the key. No `--update` needed yet.
- No TV connected. Every M2 ticket needs a hardware smoke test by the maintainer.

**Next**
- Tonight 23:35 Dhaka: T-133 (`ui/sidebar.js` + `ui/search.js`).
- After the UI slices: **T-124**, then T-125, T-126, T-127, then T-123.

---

## 2026-11-17 — Sync the night-shift prompt so a fresh machine works — @maintainer

**Ticket:** tooling · **Branch:** `chore/nightshift-prompt-sync` → `dev`
**Status:** ✅ done — the committed loop now matches the live API task

**What changed**
- **`docs/NIGHTSHIFT_PROMPT.md` (new)** — the exact plain-text prompt that
  actually ran the successful batch, with the live task settings table.
- **`.agents/loops/nightshift.md`** — prompt changed from `/nightshift` to
  that plain text. Same cron, timezone, model and agent.
- **`docs/AUTONOMY.md`** — setup table points at the shared prompt; the
  slash-command trap is recorded under "Known traps".

**Why**
OpenChamber's scheduler treats a prompt starting with `/` as a slash command
and routes it through `session.command`. On the installed v2.0.8 that failed
with `Missing key at ["name"]` four times — once on the 23:35 scheduled run
and three manual triggers — before any agent turn began. A plain-text prompt
goes through `session.prompt` and worked immediately: a 954-second run that
merged T-130, T-131 and T-132 green.

The live task on this machine had already been fixed through the API, so
tonight's run is safe. But the committed loop still carried the broken prompt,
so a fresh machine would have failed all night. This commit closes that gap.

**Verified**
- Live task prompt matches the committed file byte for byte.
- `nextRunAt` = 2026-11-17 23:35 Dhaka (unchanged).
- Last run `status: success`, both CI checks green on `b54aeff`.
- Gates on `dev`: 248 tests, lint, validate, format all clean.

**Watch out**
- Keep `docs/NIGHTSHIFT_PROMPT.md`, `.agents/loops/nightshift.md` and the
  live API task in sync. Three copies of one prompt is a liability; the doc is
  the source of truth.
- The `/nightshift` slash command still exists for interactive use. Only the
  *scheduled task prompt* must be plain text.
- No TV connected. T-130–T-132 moved UI structure but owe a hardware smoke test.

**Next**
- Queue `NEXT` = T-133 (`ui/sidebar.js` + `ui/search.js`), starting
  23:35 Dhaka tonight.
- T-121 still needs human re-scoping before M2 can finish.

---

## 2026-11-16 — T-132: OSD slice extracted; batch complete (3/3) — @nightshift

**Ticket:** T-132 ✅ · **Branch:** `feature/t-132-ui-osd` → `dev`
**Status:** ✅ done — `ui/osd.js`, z-index contract intact; batch limit reached

**What changed**
- **`player/src/ui/osd.js`** (new, 209 LOC) — 20 functions (14 public, 6
  private) + 8 slice-local vars: channel OSD, buffering pill, empty-state
  brand, watermark/badge, tune toast. Uses only `document`, `ui/state.js` and
  pure helpers from `utils.js`/`logic.js`.
- **`ui.js`** — the three OSD blocks removed (201 lines); re-exports the 14
  public names. `applySidebar()` still calls `applyWatermark()`, now imported
  one-way from `ui/osd.js` (exported from the slice). No import cycle.
- Docs: T-132 → done, `NEXT` → T-133, `LAST_RUN` = batch complete.

**Verified**
- AST export audit: **74 before / 74 after**, none added or removed.
- **z-index contract:** `styles.css` untouched; values still present —
  veil 30 (`:436`), pills 40 (`:476/:544/:758/:779`), splash 200
  (`:815/:1456`), modals 300 (`:1630`). No inline z-index in JS.
- `npm test` → 248 passed · `npm run lint` → clean · `npm run validate` →
  39 files, 0 new violations · `npm run format:check` → clean ·
  `npm run build` → `index.BbQQvWmZ.js` 966.90 kB (0 %) · `npm run tizen` →
  WGT signed with the expected fingerprint.
- No TV verification attempted or claimed.

**Decisions**
- **Extracted only what is actually in `ui.js`.** The ticket also names
  "play-state overlay" and "progress toast"; their DOM is in `index.html` but
  they are driven from `main.js:1121-1138` and `player.js:1381`, not `ui.js`.
  Inventing them here would change behaviour. They travel with the app/player
  slices instead. Recorded in the ticket status.
- **One-way call for `applyWatermark`.** Exported it from the slice and
  imported it into `ui.js` rather than duplicating it — keeps `applySidebar`
  behaviour identical and avoids a cycle (the slice never imports `ui.js`).
- **No new tests** — all moved functions are DOM-coupled; verified by export
  parity + build, as T-131 was.

**Watch out**
- `ui.js` stays in the modularity baseline until T-135 deletes it.
- `docs/REFINED_UX_REPORT.md` remains untracked and untouched.

**Next**
- T-133 (`ui/sidebar.js` + `ui/search.js`) — sidebar toggle, groups, search;
  preserve the T-037 search flow and hidden-group handling.

**Batch summary:** BATCH_LIMIT = 3 reached — T-130, T-131, T-132 all merged
and green; dev push `142442c` had both CI checks green. No blocked tickets,
no force-push, no main/release/tag/key touched.

---

## 2026-11-16 — T-131: confirm dialog extracted — @nightshift

**Ticket:** T-131 ✅ · **Branch:** `feature/t-131-ui-dialogs` → `dev`
**Status:** ✅ done — self-contained `ui/dialogs.js`, 74-name `ui.js` API intact

**What changed**
- **`player/src/ui/dialogs.js`** (new, 53 LOC) — the 5 named functions plus the
  private `updateDialogFocus`, with the 4 dialog-local vars (`dialogOpen`,
  confirm/cancel callbacks, `dialogFocus`). No imports at all: only `document`.
- **`ui.js`** — the 49-line dialog block replaced by a 5-name re-export from
  `./ui/dialogs.js`. Callers keep using `ui.showConfirmDialog` etc.
- Docs: T-131 → done, `NEXT` → T-132, `LAST_RUN` updated.

**Verified**
- AST export audit: **74 before / 74 after**, none added or removed.
- Callers checked: exit (`main.js:1507`), delete playlist
  (`settings.js:298,710`), update notice (`main.js:877`) — all via `ui.*`,
  all untouched.
- `npm test` → 248 passed · `npm run lint` → clean · `npm run validate` →
  38 files, 0 new violations · `npm run format:check` → clean ·
  `npm run build` → `index.ChQLc5Eq.js` 966.90 kB (+0.01 kB) ·
  `npm run tizen` → WGT signed with the expected fingerprint.
- No TV verification attempted or claimed.

**Decisions**
- **Pure move + re-export, no importer edits** (T-122 precedent). `main.js` and
  `settings.js` still import `* as ui`; changing them would steal T-135's work.
- **No new tests.** All dialog functions are DOM-coupled (`getElementById`),
  which Vitest cannot exercise here (node env, no jsdom). Verified by export
  parity + build instead, as T-122 was.
- Kept `updateDialogFocus` private inside the slice — it is not part of the
  public API.

**Watch out**
- The slice is deliberately dependency-free; do not import `ui/state.js` into
  it (T-131 acceptance forbids it).
- `ui.js` stays in the modularity baseline until T-135 deletes it.
- `docs/REFINED_UX_REPORT.md` remains untracked and untouched.

**Next**
- T-132 (`ui/osd.js`) — channel OSD, buffering pill, empty-state brand,
  watermark, play-state overlay, progress toast. Honour the z-index contract
  in `docs/TIZEN_GUIDE.md` §6.3.

---

## 2026-11-16 — T-130: shared UI state extracted — @nightshift

**Ticket:** T-130 ✅ · **Branch:** `feature/t-130-ui-state` → `dev`
**Status:** ✅ done — one shared `state` object; `ui.js` references prefixed; behaviour-neutral

**What changed**
- **`player/src/ui/state.js`** (new, 44 LOC) — the 18 shared UI bindings in one
  exported object, grouped (channel list, sidebars, groups, search). Plain
  object with property mutation, deliberately not a reactive store (T-170).
- **`ui.js`** — imports `state`, 290 references renamed to `state.<name>` via
  an AST transform, the 18 declarations removed. The four bare lookalikes
  (`channels:` object keys ×2, `dataset.virtualStart/virtualEnd` ×2) were left
  alone on purpose.
- **`ui/state.test.js`** (new, 5 tests) — shared identity + mutation through
  that identity, mirroring `player/state.test.js`.
- Docs: T-130 → done, `NEXT` → T-131, `LAST_RUN` set.

**Verified**
- `npm test` → 248 passed (15 files, +5) · `npm run lint` → clean ·
  `npm run validate` → 37 files, 0 new violations · `npm run format:check` →
  clean · `npm run build` → `index.6Gz8try-.js` 966.89 kB (+0.38 % vs 963.24) ·
  `npm run tizen` → WGT signed with the expected certificate fingerprint
  (`40:71:40:30…`).
- AST audit before the rewrite: the 18 names are declared **only** at module
  scope, 290 references, zero shadowing (no params/locals/catch reuse). Audit
  after: 290 `state.<name>` accesses, 4 intentional non-references.
- No TV verification attempted or claimed — no TV is connected.

**Decisions**
- **Moved exactly the 18 shared bindings, not every module-level `let`.**
  Measured 43 mutable module-level variables: 18 are shared across upcoming
  slices (the ticket list + `virtualEnd`), the other 25 are slice-local
  (dialog, OSD, right-menu audio, timers, callbacks) and stay in `ui.js` for
  their own tickets — matching `docs/MIGRATION.md` Risk C ("shared → state;
  slice-local → stays local"). This is the minimal, spec-faithful change.
- **AST transform (espree), not regex.** Regex would also hit object keys and
  `dataset.*` property names; those four were correctly excluded.
- **No reactive store.** Kept separate from T-170 so a failure has one cause.

**Watch out**
- The remaining slice-local `let`s in `ui.js` are intentional; do not sweep
  them into `state` here. Each slice ticket moves its own.
- `ui.js` stays in the modularity baseline (loc + exports) until T-135 deletes
  it; no `--update` needed.
- `docs/REFINED_UX_REPORT.md` remains untracked and untouched.

**Next**
- T-131 (`ui/dialogs.js`) — zero deps on other UI modules; confirm dialog for
  exit, delete playlist and update notice.

---

## 2026-11-16 — Night shift is live: 23:35 Dhaka, goal mode, hard policies — @maintainer

**Ticket:** tooling · **Branch:** `chore/nightshift-schedule` → `dev`
**Status:** ✅ done — every machine-side switch set; first auto-run tonight

**What changed**
- **OpenChamber scheduled task `nightshift`** created through the running
  server's API (port 3000), ID
  `35194797-b718-46d4-8066-22a54de716e0`. Cron **`35 23 * * *`**, TZ
  **`Asia/Dhaka`** — 11:35 PM Bangladesh time, as requested.
  `goalEnabled: true`, budget 400000, model `opencode/hy4-flash-free`
  (unchanged from the current session), agent `nightshift`, prompt `/nightshift`.
- **Global settings** via `PUT /api/config/settings`: Session Goals on with a
  400000 default budget; question auto-delegate on as a backstop.
- **`.opencode/opencode.jsonc`** — added
  `{ action: "*", resource: "*", effect: "allow" }` at the permission layer
  so no `ask` can stall a session with nobody present. The `deny` policies
  are a separate layer and were left intact: main, release, tags, force-push,
  `--no-verify`, key generation and key-file edits remain blocked.
- **`.agents/loops/nightshift.md`** — cron and timezone now match the live
  task (`35 23 * * *`, `Asia/Dhaka`).
- **`docs/AUTONOMY.md`** — setup section rewritten from "four steps you must
  do" to a record of what is set, with the schedule and verification evidence.

**Verified**
- `nextRunAt` = 2026-11-16 23:35 Dhaka (17:35 UTC), `schedulerSynced: true`,
  `hasEnabledScheduledTasks: true`.
- `opencode run --agent nightshift` loads and replies under the current model
  with the new permissions.
- CI green on `e2ebb1d`, the tip of `dev` when this session started.

**The probe did real work — read this before the morning report**
Trying the `/nightshift` command with a 3-minute shell timeout accidentally
launched the actual loop. It stopped when the shell timed out, but not before
it ran a full batch:
- **T-122 done** — `player/events.js` + `player/stream.js`, 24-name API intact,
  bundle unchanged in size. Merged, pushed, both CI checks green.
- **T-121 blocked** — its spec cannot be a pure move (351-LOC function plus a
  three-node import cycle). Needs maintainer re-scoping.
- **T-123 blocked** — depends on T-121, so `player.js` still owns the engine.
- Queue `NEXT` advanced to **T-130**, with full entries in `docs/SESSION_LOG.md`.
- `docs/REFINED_UX_REPORT.md` was never staged. No main/release/tag/key touched.

This is the first real proof the loop works unattended: it made a conservative
decision, recorded it, and stopped on the batch limit rather than forcing a
broken refactor.

**Decisions**
- **Config-layer allow-all, not the UI's "Accept everything".** Scheduled
  sessions are created fresh with IDs unknown in advance, so a per-session UI
  toggle cannot help them. A project config rule applies to every session.
  Policies still hard-deny the non-negotiables.
- **Same model, as asked.** The earlier warning about the free-tier usage cap
  was based on a title-refresh error in session metadata, not on the agent's
  own turns — the batch completed on `hy4-flash-free`. Keeping it.
- **Bangladesh time** chosen over the previous Kyiv default. Dhaka is UTC+6;
  23:35 local = 17:35 UTC.

**Watch out**
- **The session log has three new entries from `@nightshift`** above this one.
  Read them in order — T-121's block analysis explains why M2 cannot finish yet.
- **T-121 needs a human decision.** The loop will skip it on later runs; it
  will not force an unimplementable spec. Re-scope it as a state-injected
  cross-slice refactor before expecting `player/index.js`.
- **The loop does not restart if you quit OpenChamber.** Keep the desktop app
  or the `openchamber` process alive. Closing a tab is fine.
- **Machine-side settings are not in git.** A fresh machine needs the
  Scheduled Tasks + Settings UI steps documented in `docs/AUTONOMY.md`.

**Next**
- Let tonight's 23:35 Dhaka run go. In the morning: read the newest session log
  entry, check `git log --oneline origin/dev..dev`, check CI on `dev`.
- Re-scope **T-121** so the M2 split can finish; T-123 is waiting on it.

---

## 2026-11-16 — Night shift batch complete: 1 done, 2 blocked — @nightshift

## 2026-11-16 — Night shift batch complete: 1 done, 2 blocked — @nightshift

**Ticket:** T-121 ⛔ / T-122 ✅ / T-123 ⛔ · **Branch:** see per-ticket entries
**Status:** ✅ batch limit (3) reached — dev green, no force-push, no main/release/tag/key touched

**What changed**
- T-121 — blocked, spec unimplementable as a pure move (351-LOC function +
  three-node import cycle). Its own entry has the full analysis.
- T-122 — done: `player/events.js` + `player/stream.js`, 24-name API intact.
- T-123 — blocked: `player.js` still owns the engine because T-121 is blocked.
- `docs/AUTONOMY.md` — `NEXT` advanced to **T-130**, `LAST_RUN` set.

**Verified**
- Every gate green on the feature branch **and again on dev** after each
  merge: 243 tests, lint, modularity (0 new violations), format, build, and
  `npm run tizen` with the expected certificate fingerprint.
- Bundle 963.24 kB → 963.24 kB (0 %), well inside ±2 %.
- CI on `dev`: `Test · Lint · Build · Modularity` green; `WGT packaging`
  checked after the push (see status note below).

**Decisions**
- Three tickets processed, then stop — `BATCH_LIMIT = 3`. Two of them blocked,
  but **not consecutively** (T-122 landed between them), so stop condition 2
  did not fire.
- No TV verification claimed. T-122 moved DRM-adjacent code but changed no
  logic; `isEmeSupported` was copied verbatim and the bundle is unchanged in
  size. Hardware smoke test is still owed by the maintainer.

**Watch out**
- The maintainer must re-scope **T-121** before M2 can finish. Until then,
  T-123 cannot land and the `player/index.js` hub does not exist.
- `docs/REFINED_UX_REPORT.md` is still untracked and was never staged.
- GitHub prints "Bypassed rule violations ... 2 of 2 required status checks
  are expected" on each dev push — the checks attach to the new SHA shortly
  after; both were green when checked.

**Next**
- Maintainer: re-scope T-121 as an atomic M2 refactor (state-injected
  cross-slice calls, ~6 modules), then re-run. The queue resumes at T-130 for
  the next automated batch.

---

## 2026-11-16 — T-122: events and stream slices extracted — @nightshift

**Ticket:** T-122 ✅ · **Branch:** `feature/t-122-events-stream` → `dev`
**Status:** ✅ done — 2 new modules, public API byte-for-byte intact

**What changed**
- **`player/events.js`** (new) — the five `on*` subscription setters, writing
  callbacks into the shared `state` object only.
- **`player/stream.js`** (new) — 13 pure queries/selection helpers:
  `getActiveTrack`/`Height`/`Bandwidth`, `isEmeSupported`, `setAutoQuality`,
  `getPlayer`, `getBufferingPercent`, `getResolutions`, `selectResolution`,
  `getAudioTracks`, `getActiveAudioId`, `selectAudioTrackById`,
  `getVideoElement`.
- **`player.js`** — deleted those 18 definitions, imports the four it still
  calls (`getActiveTrack`, `getActiveHeight`, `getBufferingPercent`,
  `isEmeSupported`) and re-exports all 18 so `import * as player from
  './player.js'` is unchanged. No importer edits were needed.
- Docs: T-122 → done, `NEXT` → T-123.

**Verified**
- Export parity measured with the validator's own regexes: **24 names**,
  identical to the pre-split set.
- `npm test` → 243 passed (14 files) · `npm run lint` → clean ·
  `npm run validate` → 35 files, 0 new violations · `npm run format:check` →
  clean · `npm run build` → `index.CalN-gHB.js` 963.24 kB (0 % vs baseline) ·
  `npm run tizen` → WGT signed with the expected certificate fingerprint.
- No TV verification attempted or claimed.

**Decisions**
- **Kept the split to exactly the two modules the ticket names.** The explore
  pass suggested a 7-module rewrite with state-injected hooks (for the T-121
  cycle), but that is T-121's problem, not T-122's. The subscription setters
  and stream getters depend only on `state`, so they lift out with no shared
  helper module, no hooks and no cycle. T-122 stands on its own even though
  T-121 is blocked.
- **`player.js` re-exports rather than repointing importers.** T-123 still
  owns deleting `player.js` and creating the index hub; changing `main.js`
  and `settings.js` here would have stolen that ticket's work.

**Watch out**
- The re-export block in `player.js` is a deliberate temporary bridge. T-123
  must replace it with `player/index.js` before deleting `player.js`.
- `onTuneAttempt` moved with the other setters; `notifyTuneAttempt` (the
  internal notifier) deliberately stayed in `player.js` — it is not part of
  the 24-name API and `loadChannel` calls it directly.
- `docs/REFINED_UX_REPORT.md` remains untracked and untouched.

**Next**
- T-123 depends on T-121 and cannot land while init/load are still in
  `player.js`; expect it to block.

---

## 2026-11-16 — Night shift: T-121 blocked, setup committed — @nightshift

**Ticket:** T-121 ⛔ · **Branch:** `docs/t-121-block` → `dev`
**Status:** ⛔ blocked — spec is not implementable as written; no code changed, no gate run red

**What changed**
- **First, a prerequisite:** the night-shift setup documented in the entry
  below as "✅ done" was still **uncommitted** on `dev`. That dirty tree
  would have blocked the one-branch-per-ticket workflow (and risked mixing
  the setup into a ticket commit). Committed it on `chore/nightshift-autonomy`,
  merged to `dev` (`e89c4be`) and pushed. `docs/REFINED_UX_REPORT.md` was
  deliberately left untouched — pre-existing user work, as instructed.
- **`docs/TICKETS.md`, `docs/AUTONOMY.md`** — T-121 marked `blocked`,
  `NEXT` advanced to T-122, `LAST_RUN` set.
- No `player/src` changes.

**Verified**
- Gates on `dev` after the setup merge: `npm test` → 243 passed (14 files),
  `npm run lint` → clean, `npm run validate` → 33 files / 0 new violations,
  `npm run format:check` → clean, `npm run build` → `index.B8n1RqJs.js`
  963.24 kB (baseline for the T-121 ±2 % criterion).
- CI on pushed `e89c4be`: both checks green (`WGT packaging`,
  `Test · Lint · Build · Modularity`).
- The block is a **design** finding, not a gate failure — derived by mapping
  every call in the 1572-line `player.js`.

**Decisions**
- **Committed the setup before touching a ticket.** Its own session-log
  entry says `chore/nightshift-autonomy → dev` and "✅ done", but git showed
  it dirty and uncommitted. Committing it (hard policies deny release, tags,
  main and signing-key operations — it only *adds* protection) restores the
  clean tree an unattended run needs. The alternative — leaving it dirty —
  would have made the T-121 docs edits conflict on merge.
- **Blocked T-121 instead of improvising a 7-module rewrite.** Two hard
  facts defeat the spec as a pure move: `loadChannel` is 351 LOC (the guard
  caps new files at 300), and `initPlayer → handlePlayerError → loadChannel →
  initPlayer` is a three-node import cycle the guard forbids. Breaking it
  means state-injected cross-slice calls (~6 hooks) and ~6 new modules
  (`shared`, `stream`, `events`, `init`, `load`, `load-error`), i.e. all of
  M2 compressed into one ticket, on playback code that cannot be smoke-tested
  on a TV from this machine. That is a human re-scoping decision, not an
  unattended one.
- **No TV verification claimed or attempted.**

**Watch out**
- The WGT asset name is content-hashed; after `e89c4be` the baseline bundle
  is `index.B8n1RqJs.js` at 963.24 kB, so the T-121 ±2 % window is
  **944.0–982.5 kB** measured against a *committed* tree.
- `player.js` is still in the modularity baseline. Shrinking it does **not**
  remove the baseline key (`rule:file`), so `--update` is not needed until a
  file actually drops below 300 LOC or disappears.
- `docs/REFINED_UX_REPORT.md` is still untracked. Never stage it.
- GitHub reported "Bypassed rule violations ... 2 of 2 required status checks
  are expected" on the push — the checks were not yet attached to the new
  SHA at push time; both were green when checked afterwards.

**Next**
- T-121 needs a human re-scope: split M2 into an atomic refactor or add the
  state-hook contract to the ticket before an agent retries it.
- This run continues with **T-122** (`events.js` + `stream.js`), which is
  independently feasible.

---

## 2026-11-16 — Unattended night-shift setup — @maintainer

**Ticket:** tooling · **Branch:** `chore/nightshift-autonomy` → `dev`
**Status:** ✅ done — repo-side config complete; four OpenChamber UI switches left to the maintainer

**What changed**
- **`.opencode/opencode.jsonc`** — hard **policies**, not permissions. A
  policy deny survives OpenChamber's "Accept everything" mode, so an
  unattended agent cannot release, tag, force-push, commit to `main`, or
  mint/overwrite a signing key no matter how it reasons.
- **`.opencode/agents/nightshift.md`** — primary agent with `question` **denied**.
  It must decide conservatively and write the decision into the session log.
  Encodes branch/gate/commit/merge/CI/session-log steps and three retries.
- **`.opencode/commands/nightshift.md`** — `/nightshift`, a self-contained goal
  objective. Written for the auditor, which sees only the objective and the
  last reply, not chat history.
- **`.agents/loops/nightshift.md`** — cron `0 22 * * *`, agent `nightshift`,
  enabled in the file. OpenChamber still requires a UI toggle per machine and
  a UI "Run as goal" tick — both documented in `docs/AUTONOMY.md`.
- **`docs/AUTONOMY.md`** — authoritative 38-ticket queue with `BATCH_LIMIT=3`,
  dependencies, stop conditions, known traps, and the five UI setup steps.
- **`docs/TICKETS.md`** — three defects that would have derailed an unattended
  run, fixed:
  - T-101/T-102/T-103 had no Status line though done → added, pointing at the
    groundwork commit.
  - T-114's status was filed under the T-115 section → added its own.
  - **T-181 was used twice** (VOD media-by-URL and settings migration). The
    settings migration is now **T-186**; history still says T-181 for both.
- **`AGENTS.md`** — links `docs/AUTONOMY.md`.

**Verified**
- Config parsed by OpenCode v2.2.5 — `nightshift` agent and `/nightshift`
  command are discovered (see gates below).
- No changes to `player/src`; gates still run to confirm nothing regressed.

**Decisions**
- **Policies over permissions.** "Accept everything" is the only mode that
  reliably answers every `ask` while asleep, and it cannot lift a `deny`. So
  the five non-negotiables are expressed as policies. The safety-net mode was
  rejected: it needs a Jev provider and can hold a request for four seconds.
- **`BATCH_LIMIT = 3`.** A single nightly goal that tried all 38 tickets would
  blow the token budget and never let the auditor declare completion. Three
  tickets per run, then a clean STATUS block, is reviewable in the morning.
- **Question tool denied on the agent.** The maintainer explicitly wants
  autonomous decisions. A blocked question would stall the whole night.
- **`needs-tv` states pre-marked** for T-184, T-185, T-190, T-191 so the agent
  cannot claim hardware verification it cannot perform.

**Watch out**
- **The loop does not start from the file alone.** `enabled: true` is
  overridden by OpenChamber's per-machine off-by-default rule for repo loops.
  Turn it on in Scheduled Tasks and tick **Run as goal**, or the task fires
  once and stops after one reply.
- **Goal settings are UI-only** for loop files. `BATCH_LIMIT` in the markdown
  is read by the agent; the token budget is a separate UI setting.
- **Check `NEXT` after each run.** The agent updates `docs/AUTONOMY.md`, so a
  missed update makes the next run redo a ticket. CI green on `dev` is the
  authority, not the agent's summary.
- **`opencode.json` is gitignored** as a local model preference. The config
  here is `.opencode/opencode.jsonc` on purpose — that one is committed.

**Next**
- Maintainer: do the five UI steps in `docs/AUTONOMY.md`, press **run now** once,
  and watch the first batch. Then let the 22:00 schedule take over.
- The queue starts at **T-121** (`player/init.js` + `player/load.js`).

---

## 2026-11-16 — T-120: recovery became a plan, not 165 lines of side effects — @maintainer

**Ticket:** T-120 ✅ · **Branch:** `refactor/t-120-player-recovery` → `dev`
**Status:** ✅ done — the highest-risk logic in the app is now unit-tested

**What changed**
- **`player/src/player/recovery.js` (new, 209 LOC)** — decision-only. One pure
  function `planRecovery(error, ctx)` returns
  `{ action, delay?, counters?, segment404?, status?, log?, message? }`.
  Actions: `none · ignore · pdt-retry · forbidden-reload · token-refresh ·
  reload · reconnect · giveup · advance · terminal`.
- **`player.js`** — `handlePlayerError` is now a `switch` over the plan. All
  side effects (loads, timers, logging, `showError`) stayed put. The local
  `isTransientBlip` was deleted; `scheduleReconnect` and
  `scheduleForbiddenReload` take the delay the plan computed.
- **63 new tests** in three files (196 → **243** total).

**The spec's shape could not work, and I changed it**
The ticket says put `handlePlayerError` *and* `scheduleReconnect` *and*
`giveUpTune` in `recovery.js`. That is an import cycle: `recovery` would call
`loadChannel` (which belongs in `load.js`) and `load.js` calls
`scheduleReconnect`. The guard forbids cycles, and all three functions touch
timers or the DOM, so none of them could be tested in the node env anyway —
the ticket's own acceptance criterion was unreachable in that shape.

So `recovery.js` decides and `player.js` acts. The tests then cover exactly what
the ticket asked for: which decision maps to which action, for every branch.

**Two behaviour traps, both caught by characterising rather than assuming**
1. **`hardReloads` is incremented then compared**, so the *third* hard reload
   gives up — `hardReloadDecision(3) === 'giveup'`. My first test asserted
   "still reloads at exactly two" and failed; the code was right and the test
   was wrong. Good outcome, but only because the test existed.
2. **An exhausted 401/403 falls through to the terminal handler**, which logs
   and calls `showError` *before* starting the 4-second advance. My first
   rewrite returned early on that branch and silently dropped the user-facing
   error message.

**One bug I introduced and caught myself**
`reconnectAttempts` was both returned as a plan counter *and* incremented
inside `scheduleReconnect()`. Double-counting halves the retry ladder: attempt
1 would schedule at 2s instead of 1s. The plan now derives the delay from
`ctx.reconnectAttempts + 1` and leaves the increment where it was.

**Verified**
- `npm test` → **243 passed** · `lint` clean · `validate` 33 files, 0 new
  violations (7 baselined) · `format:check` clean
- `npm run build` ok · `npm run tizen` → WGT 469.9 KB
- **Bundle 938.3 → 940.7 KB (+0.26 %)** — well inside the plan's ±2 %.
- Sequence tests replay a whole incident (three hard-reload cycles, the full
  auth ladder, three 404 reloads) and assert the ladder still terminates where
  the original did.

**Decisions**
- **Plans return counters, they do not mutate state.** That is what keeps the
  counter order visible and testable. `player.js` applies them in one loop.
- **`reconnectAttempts` is the one counter the plan does not own**, because the
  increment lives in `scheduleReconnect` and moving it would have been a
  second change in one commit.
- **Conditional logging via a `log` field**, not a branch in the caller. The
  plain auth retry logged a segment line; the refresh-without-callback fallback
  logged nothing, and that difference is now explicit in the plan.
- **Test files split** to stay under the 300-LOC rule — the validator caught
  `recovery.test.js` at 314 LOC twice before I split off
  `recovery-terminal.test.js`. Budget for this when adding branches.

**Watch out**
- **`recovery.js` must never import from `player.js`.** The cycle is the reason
  the shape changed; re-introducing it will fail `npm run validate`.
- **`logic.js` was not touched.** It still owns the numbers (backoff, budgets).
  `recovery.js` composes it. Keep it that way or the numbers get two homes.
- **`handlePlayerError` still logs before deciding** (the `sinceAdapt` line and
  `console.error`). That is intentional — diagnosing a TV error needs the log
  even when the plan says `ignore`.
- **The `giveup` vs `advance` distinction matters:** `giveup` calls
  `giveUpTune()` (stops, terminal message); `advance` reports the error and
  then moves to the next channel after `plan.delay`. Conflating them changes
  what the user sees.

**Next**
- **T-121 (`init.js` + `load.js`)** — the actual slicing, now safe because the
  state is shared and the recovery decisions are out. Watch the `loadChannel`
  ↔ `scheduleReconnect` boundary: `load.js` will need to import from
  `recovery.js`, which is fine, but `recovery.js` must keep importing nothing
  from `load.js`. If that becomes impossible, the plan callback moves into the
  caller instead.

---

## 2026-11-16 — T-129: 45 shared bindings into one state object — @maintainer

**Ticket:** T-129 ✅ · **Branch:** `refactor/t-129-player-state` → `dev`
**Status:** ✅ done — Risk C mitigated; T-120 is unblocked

**What changed**
- **`player/src/player/state.js` (new, 103 LOC)** — one exported `state`
  object holding **45** bindings: engine/DOM handles, subscriptions, current
  tune + `loadToken`, reconnect and stall budgets, the segment-404 window, the
  native-fallback flags, and the three URL-keyed workaround caches.
- **`player.js`** — every read/write is now `state.<name>`; the 45 declarations
  are gone. 1533 → 1464 LOC.
- **`state.test.js` (9 tests)** — pins object identity (not a factory), the
  staleness-guard semantics, shared `Set`/`Map` membership, and that
  `useAvplay` stays runtime state rather than a capability.
- **196 tests** (was 187).

**How the rename was done, and why not a regex**
`player.js` line 24 contains a regex literal with quote characters in it
(`/(https?:\/\/[^\s'"]+?)[?#]/`). A hand-written string/comment scanner cannot
tell `'` inside a regex from the start of a string, so it desynced — my first
attempt reported **0 renames** while looking like it had succeeded. The fix was
to parse with `acorn` (already present via eslint) and rewrite by identifier
node range, which excluded `config.player` and `shaka.Player` automatically.
Result: **495** rewrites, all 45 names touched.

**Verified**
- `npm test` → **196 passed** · `lint` clean · `validate` 29 files,
  0 new violations, 7 baselined · `format:check` clean
- `npm run build` ok · `npm run tizen` → WGT 469.3 KB
- **Bundle 931.9 → 938.3 KB (+0.69 %)** — inside the plan's ±2 % criterion.
  The delta is the 495 `state.` prefixes; nothing else was added.
- **Diff audit:** every added line except the import and three comment lines
  contains `state.` — the change is a pure rename.
- Bare-identifier grep for all 45 names returns nothing outside strings and
  comments.

**Decisions**
- **Property mutation, never destructuring.** `const { loadToken } = state`
  would snapshot a number and every staleness comparison would silently pass.
  All 495 sites are `state.x`.
- **No `resetTuneState()` helper**, though it was tempting. The five reset
  blocks in `loadChannel` restore *different* subsets (567–582, 730–734,
  1402–1405, 1437–1450). Unifying them would have changed behaviour inside a
  commit that claims to be a pure move. The state moved; the reset logic did
  not.
- **T-130 will hit the same trap.** `ui.js` has the same shape, and the ticket's
  "21 variables" estimate was low here by more than half — expect more.

**Watch out**
- **`player.js` was NOT on the `.prettierignore` ratchet** (unlike
  `settings.js`/`avplay.js`/`remote.js`), so it was already prettier-clean and
  the rename broke its formatting. Ran `prettier --write` to restore it. If a
  future edit shows a formatting failure here, that is the cause — not a new
  legacy exemption.
- **`state` is a plain object, not reactive.** T-170 converts it later, in a
  separate phase, so a failure then has one cause. Do not add subscribers here.
- **`useAvplay` genuinely belongs in `state`**, even though it looks like a
  capability. It records that *this channel* fell back (T-115). The probe
  answers what the *platform* can do.
- **The WGT still carries the old hash** (`dfa0ba8`) because the name comes
  from the last commit. Expected; it only proves signing works.

**Next**
- **T-120 (`player/recovery.js`)** is now unblocked and is the real reason
  T-129 existed — the retry budgets live there and it is the highest-risk file
  in the app. Tests first: ≥30 composition tests mapping each decision to its
  action, before any slicing.
- Then the rest of M2 (`init.js`, `load.js`, `events.js`, `stream.js`) and
  `player/index.js` as the re-export hub.

---

## 2026-11-16 — T-115: one probe, and two latent bugs it exposed — @maintainer

**Ticket:** T-115 ✅ · **Branch:** `refactor/t-115-capability-wiring` → `dev`
**Status:** ✅ done — `capabilities.js` is now the only detection site

**What changed**
- **Probe extended:** `hasTvInputDevice`, `hasApplicationControl`.
- **New pure decisions** in `lib/capabilities.js`: `hasTvKeyInput(caps)`,
  `platformName(caps)`.
- **Rewired 5 consumers:** `avplay.isAvailable()` → `capabilities().hasAvplay`;
  `main.js` (`registerTizenKeys`, app exit); `remote.js` (search-field
  Backspace/Enter); `settings.js` (IME re-focus); `update.js` (ping `tv`).
- **187 tests** (was 177).
- **Format ratchet honoured:** `settings.js`, `avplay.js`, `remote.js`
  reformatted and dropped from `.prettierignore` — now only `styles.css` and
  `xtream.js` remain.

**Two bugs this ticket uncovered — both would have shipped silently**

1. **`hasShaka` was always `false` on real TVs.** The probe read
   `window.shaka || window.ShakaPlayer`, but the app *imports* Shaka as an ES
   module (`import shaka from 'shaka-player'`) and never assigns that global.
   `selectEngine()` would therefore have concluded that a perfectly good Shaka
   TV was native-only. Nobody noticed because no consumer had read
   `selectEngine()` yet. Now hardcoded `true`, with a regression test asserting
   `hasShaka === true` even when every global is absent, plus a "do not
   restore" note in `TIZEN_COMPAT.md` §4.

2. **`settings.js` cached the probe at module load.** `const isTizenTV =
   hasTvKeyInput(capabilities())` ran at import time, which is before Tizen has
   necessarily injected `tizen` — so the flag could freeze at `false` and the
   soft-keyboard re-focus would silently stop working on TV. Replaced with a
   lazy `onTv()` helper evaluated at call time. `remote.js` was already safe
   (its read sits inside the keydown handler).

Neither bug is reachable by a test on the old code, and neither is verifiable
here without a TV — which is exactly why they were worth hunting rather than
assuming the mechanical rewrite was safe.

**Verified**
- `npm test` → **187 passed** (10 files) · `lint` clean ·
  `validate` 27 files, 0 new, 7 baselined · `format:check` clean
- `npm run build` ok · bundle under budget · `npm run tizen` → WGT 468.7 KB
- **Detection audit:** `grep "typeof window.webapis" player/src` → **no hits**.
  All remaining `window.tizen.*` occurrences are API *calls* behind a guard
  (`registerKey`, `getCurrentApplication`), which is correct and must stay.

**Decisions**
- **`hasShaka` hardcoded, not probed.** There is no runtime signal for it —
  the bundler decides. Probing a global the app never sets is worse than
  constant `true`, because it is confidently wrong.
- **`selectEngine()` kept, though it can now only return `'shaka'`.** It still
  encodes the preference order and is the contract the future `recovery.js`
  will call; deleting it would just move the decision back into a caller.
  Its doc comment now states plainly that it answers "what could we use", not
  "what is this channel using".
- **Lazy read, not cache invalidation.** Rather than adding a `reset()` call
  somewhere in the boot sequence that nobody can verify without a TV, the
  probe read simply moved to the point of use.

**Watch out**
- **`window.shaka` will look like an obvious thing to add back.** Don't.
- **`detectCapabilities()` still defaults `webAPIVersion` to `5.0`** when no
  `tizen` global exists. Desktop convenience, not a detected value —
  `meetsMinimumPlatform()` returns `true` for non-Tizen anyway.
- **`player.js`'s `useAvplay` is untouched and must stay separate.**
  It is per-channel runtime state; `selectEngine()` is platform capability.
- **`npm run tizen` in this session built `EN-IPTV_Player_v3.2.0_ef1e204.wgt`**
  — the hash still says `ef1e204` because the WGT name comes from the last
  commit, so it does not reflect T-115's changes yet. Not a problem (it only
  proves signing works), but do not mistake it for a T-115 artifact.

**Next**
- **M2 — the `player.js` split.** **T-129 (`player/state.js`) must land before
  T-120**: `player.js` and `ui.js` share module-level variables, and slicing
  naively gives each slice its own copy — the UI silently stops working.
- Still open from earlier: `fix(drm)` ticket for the unterminated-brace
  `parseLicenseKeyValue` behaviour, pinned as characterisation for now.

---

## 2026-11-16 — M1 closed: `lib/time.js` and capabilities probe — @maintainer

**Ticket:** T-113 ✅ · T-114 ✅ (new T-115 opened for the wiring)
**Branch:** `refactor/t-113-114-lib-time-capabilities` → `dev`
**Status:** ✅ **Phase 1 (M1) complete** — all five `lib/` modules landed

**What changed**
- **`lib/time.js` (37 LOC)** — `timeAgo`, `formatDate` extracted from
  `settings.js`. Both now take an optional pinned `locale`, and `timeAgo`
  takes an optional `now` reference instant so the buckets are testable
  without freezing the clock. `settings.js` keeps calling the 1-arg form, so
  behaviour is unchanged; 1067 → 980 LOC.
- **`lib/capabilities.js` (78 LOC)** — pure platform decisions:
  `parseWebApiVersion`, `meetsMinimumPlatform`, `selectEngine`,
  `engineLabel`, `missingApis`, `canObserveVideoFrames`,
  `MIN_WEB_API_VERSION` (5.0).
- **`player/src/capabilities.js` (68 LOC)** — the probe: the single place that
  reads `window`/`navigator`, with `detectCapabilities(win?)` injectable for
  tests, every global read wrapped in `try/catch`, plus a cached
  `capabilities()` and `currentEngine()`.
- **48 new tests** (12 time + 24 lib/capabilities + 10 probe). Total
  **133 → 177**.

**Why capabilities is two files, not one**
`docs/TIZEN_COMPAT.md` §4 specifies `lib/capabilities.js` for the probe, and
`docs/v4.PLAN.md` §4 follows it. That cannot pass the guard: `lib/` is
DOM-free by rule, and `scripts/validate-modularity.mjs` tests
`/\bwindow\b/`, which `typeof window !== 'undefined'` trips — the exact
pattern the spec uses. Rather than weaken the rule or exempt the file, the
probe moved beside `avplay.js` and only the pure decisions stayed in `lib/`.
This also happens to be better: the decisions are now testable with a plain
object instead of a fake global.

**Verified**
- `npm test` → **177 passed**, 10 files
- `npm run lint` → clean
- `npm run validate` → 27 files, 0 new violations, 7 baselined
- `npm run format:check` → clean (after `prettier --write` on 2 new files)
- `npm run build` → ok · 931.2 KB, under budget
- `npm run tizen` → WGT 468.5 KB
- **Bundle inspection, because `settings.js` cannot be unit-tested:** the
  built asset contains `Just now` (time.js) and `requestVideoFrameCallback`
  (capabilities), confirming both modules are actually wired in and not
  tree-shaken away. `settings.js` has the import at line 7, the two call
  sites at 593/897, and **no remaining local definitions**.

**Decisions**
- **`timeAgo`'s `now` parameter over fake timers.** Injecting the reference
  instant keeps `lib/` free of test-only time mocking and makes every bucket
  assertion exact. The 1-arg call form still works, which is why `settings.js`
  needed no edits at its call sites.
- **Capability probe split, rule kept intact.** Exempting `capabilities.js`
  from the DOM rule would have created the first hole in a guard that is
  otherwise absolute, for the sake of matching a document. The document was
  wrong; it is corrected below.
- **Wiring left out of T-114, tracked as T-115.** Its acceptance said "every
  platform decision reads from here". Making that true means rewriting
  `avplay.isAvailable()` and `player.js`'s engine selection — real behaviour
  risk against a box that cannot be tested on a TV from here. Recorded, not
  silently dropped.

**Watch out**
- **`useAvplay` in `player.js` is runtime state, not a capability.** It
  records that a *specific channel* fell back to native. `selectEngine()`
  reports what the *platform* can do. T-115 must not collapse them.
- **`detectCapabilities()` defaults `webAPIVersion` to `5.0` when there is no
  `tizen` global.** That is a desktop-friendly default, not a detected value;
  `meetsMinimumPlatform()` returns `true` for non-Tizen regardless.
- **The format gate caught my new files again** (2 of them). It fires on every
  new file — budget for `prettier --write` before the first gate run.
- `docs/TIZEN_COMPAT.md` §4 still shows the probe living in `lib/`. Corrected
  in a follow-up commit; if you read the §4 snippet first, it will not match
  the tree until then.

**Next**
- **T-115** — route `avplay.isAvailable()` and `player.js`'s engine choice
  through the probe, characterising current behaviour first.
- Then **M2 (`player.js` split)**, where **T-129 (`player/state.js`) must land
  before T-120** — the migration guide's warning about a naive slice
  duplicating the 21 shared module variables.

---

## 2026-11-16 — T-111 / T-112 test expansion closes the M1 loose ends — @maintainer

**Ticket:** T-111 ✅ · T-112 ✅
**Branch:** `chore/t-111-112-lib-tests` → `dev`
**Status:** ✅ done — M1's five modules all have colocated suites

**What changed**
- **`lib/url.test.js` (152 LOC, 34 tests)** for `withAuthQuery`, `redactUrl`
  and `extractAuthQuery`. Beyond the ≥20 bar, it pins: append-vs-merge into an
  existing query string, fragment preservation and the case where the param
  name appears only *inside* the fragment, prefix-collision avoidance
  (`__hdnea__extra` must not satisfy `__hdnea__`), regex metacharacters in a
  param name treated literally, the `data:` / `blob:` / `file:` non-network
  pass-through (BUG-013 / v3.0.4), and duplicate-token suppression in cookies.
- **`lib/drm.test.js` (102 LOC, 19 tests)** for `parseLicenseKeyValue`. All
  three `license_key` forms, hex normalisation, dash stripping from UUID-style
  keys, partial-dict recovery, and every rejection path.
- **`utils.test.js` (148 → 97 LOC)** trimmed to the network layer only, and
  extended while there: `{channels:[…]}` unwrapping, JSON with no channels
  array, malformed JSON, a body that is neither JSON nor M3U, and the HTTP
  status appearing in the error message.

**Verified**
- `npm test` → **133 passed**, 7 files (was 86)
- `npm run lint` → clean
- `npm run validate` → 21 files, 0 new violations, 7 baselined
- `npm run format:check` → clean **after** `prettier --write` on the three
  new/edited test files
- `npm run build` → ok · size under budget
- `npm run tizen` → WGT 468.5 KB, certificate `40:71:40:30:04:D9:49:25…`
- All test files ≤ 300 LOC (102 / 123 / 152)

**Decisions**
- **Kept the m3u naming as `lib/m3u.test.js` and added two new files rather
  than redistributing into one suite.** Each module owns its tests; a reader
  looking at `lib/url.js` finds `lib/url.test.js` beside it.
- **Two failing expectations were rewritten to match the code, not the
  reverse.** See "Watch out" — this is the intended use of a characterisation
  test.
- **`utils.test.js` extended, not just trimmed.** Cutting the moved
  assertions would have left the network layer thinner than before.

**Watch out**
- **The characterisation tests immediately caught two of my own wrong
  assumptions**, which is exactly why they exist:
  1. `parseLicenseKeyValue(`{nothex:KEY,KID:alsonothex}`)` returns **null**,
     not an empty `clearKeys` object — the function returns null when no valid
     pair survives. My first test asserted `.clearKeys` on a null.
  2. An **unterminated** brace block `{KID:KEY` still parses, because the
     non-JSON fallback strips a *leading* `{` and an *optional* trailing `}`.
     This looks like a latent bug but is harmless in practice (Kodi never emits
     it), so it is recorded as characterisation with a comment rather than
     "fixed" — changing it would be a behaviour change with no ticket.
- **The format ratchet bit my own new files.** `prettier --check` failed on
  the three files I had just written; the gate is real and applies to new
  code immediately. Worth expecting on every future commit.
- **`utils.test.js` is now 97 LOC but was 148.** If someone later looks for
  `withAuthQuery` tests and cannot find them there, they moved to
  `lib/url.test.js` — not deleted.

**Next**
- **T-113 / T-114** to close M1: `lib/time.js` from `settings.js`
  (`timeAgo`/`formatDate`) and a new `lib/capabilities.js`.
- M1 completion then unblocks M2 (`player.js` split), where **T-129
  (`player/state.js`) must land before T-120** — the migration guide's warning
  about duplicated module state.

---

## 2026-11-16 — formatting made enforceable, WGT gate added — @maintainer

**Ticket:** T-210 (new — tooling hygiene)
**Branch:** `chore/t-210-format-gate` → `dev`
**Status:** ✅ done

**What changed**
- **Root cause of the permanently-red `format:check`: line endings, not
  style.** The repo stored LF (`git ls-files --eol` → `i/lf`) but
  `core.autocrlf=true` checked everything out as CRLF, and Prettier defaults
  to `endOfLine: lf`. 21 of the 26 reported failures were this and nothing
  else. Added **`.gitattributes`** (`* text=auto eol=lf`, with CRLF
  preserved for `.bat`/`.cmd`/`.ps1`, binary for assets) and set
  `endOfLine: "auto"` in `.prettierrc`.
- **The other 5 failures were real, and are now a ratchet, not a reformat.**
  Measured first: formatting `settings.js` alone rewrites 997 of 1067 lines;
  all five together rewrite ~3158 lines. `AGENTS.md` §11.6 forbids exactly
  that. Added **`.prettierignore`** listing the five never-formatted files,
  with the rule that each is formatted on next touch and its line deleted
  then. `format:check` is now **green** and meaningful: 26 failures → 0.
- **CI no longer tolerates formatting failures.** Replaced the
  `continue-on-error: true` prettier step with `npm run format:check`.
- **`npm run tizen` added to the pre-merge checklist** (`AGENTS.md` §11, new
  rule 9). `build` proves the bundle compiles; `tizen` is the only gate that
  proves the installable WGT is signable and signed with the right key.

**Verified**
- `npm test` → 86 passed, 5 files
- `npm run lint` → clean
- `npm run validate` → 19 files, 0 new violations, 7 baselined
- `npm run format:check` → **all matched files clean** (was 26 failures)
- `npm run build` → ok · size gate under budget
- **`npm run tizen` → `EN-IPTV_Player_v3.2.0_ad7c7f6.wgt`, 468.5 KB**;
  extracted `signature.xml` and confirmed the signer fingerprint is
  `8F:73:83:29:…:80:90:23`, matching every file in `releases/`
- All six own commits re-validated against `scripts/check-commit-msg.mjs` —
  each passes

**Decisions**
- **Ratchet, not reformat.** ~3158 lines of pure-whitespace churn would bury
  any real change in the same commit and make a bisect impossible. The
  ignore-list is explicit, commented, and shrinking.
- **`.gitattributes` over relying on `core.autocrlf`.** Per-machine config
  is not a property of the repo; a fresh Linux clone and this Windows box
  must agree without setup.
- **`endOfLine: "auto"`** so a CRLF checkout cannot fail the check for a
  reason that has nothing to do with code style. `.gitattributes` keeps LF
  canonical either way.

**Watch out**
- **`prettier --check` was never the problem — the harness was.** Worth
  knowing before debugging it again: 21/26 failures vanished the moment line
  endings were normalised.
- **Prettier's member-chain rule, not `printWidth`, explains the remaining
  wrap.** `String(x).trim().replace(...)` is 3 chain groups and always
  breaks; `String(x).trim()` stays inline. Any line-length-based diagnosis
  of those 5 files is wrong.
- **A UTF-8 BOM breaks the commit-msg validator.** Re-testing an old commit
  message with `Out-File -Encoding utf8` adds a BOM, which the validator
  correctly rejects as a malformed header. Use
  `[System.IO.File]::WriteAllText(path, text, UTF8Encoding($false))`. This
  produced a false alarm — six passing commits reported as failing.
- **No TV testing was done.** `npm run tizen` proves packaging and signing,
  not runtime behaviour. The sideload + inspector smoke test from
  `docs/TIZEN_GUIDE.md` is still the maintainer's step, and `TizenSdb` is
  not installed on this machine (`SDB: null` in the packager output).

**Next**
- Finish T-111 and T-112 test expansion (colocated `lib/url.test.js` ≥20,
  `lib/drm.test.js` ≥15), then T-113 / T-114 to close M1.

---

## 2026-11-16 — Phase 1 opened: `lib/` extracted, `utils.js` off the baseline — @maintainer

**Ticket:** T-110 ✅ (T-111/T-112 modules moved, test expansion still open)
**Branch:** `feature/t-110-lib-m3u` → `dev`
**Status:** ✅ merged — first baselined violation retired

**What changed**
- **`player/src/lib/` created** with three DOM-free modules:
  - `m3u.js` (157) — `parseM3u`, `parseStreamHeaders`, `processStreamUrl`,
    `findNameSeparator`
  - `url.js` (73) — `extractAuthQuery`, `withAuthQuery`, `redactUrl`
  - `drm.js` (57) — `parseLicenseKeyValue`, `normalizeHex`, `isHex`
- **`utils.js` 348 → 66 LOC.** It now holds only the network layer
  (`fetchPlaylist`, `fetchPlaylistEntry`, `fetchPlaylistWithRetry`) and
  `escapeHtml`. `parseM3u` is imported from `lib/m3u.js` so the public
  surface of `utils.js` is unchanged for its three call sites.
- **Ratchet baseline 8 → 7 violations** (`--update`). `utils.js` is gone from
  it permanently; it cannot come back without failing `npm run validate`.
- **Tests 61 → 86.** New `lib/m3u.test.js` (+25) characterises the edge cases
  the old suite never asserted: `?`-before-edge-param handling, DRM
  directives being skipped rather than becoming headers, literal-`|` vs
  `%7C` precedence both ways, malformed percent-encoding not throwing,
  duplicate user-agent resolution, `tvg-chno` beating `channel-number`,
  zero/negative/NaN channel numbers, CRLF playlists, malformed `EXTHTTP`,
  and a later `KODIPROP` merging over an earlier `EXTHTTP` instead of
  replacing it.

**Verified**
- `npm test` → 86 passed, 5 files
- `npm run lint` → clean
- `npm run validate` → 19 files, 0 new violations, 7 baselined
- `npm run build` → ok; **bundle 953 493 B vs 953 499 B before the move**
  (stash-and-rebuild comparison), a 6-byte delta from module-boundary naming,
  well inside the ±2 % tolerance in §4 Phase 2
- DOM purity: `grep` for `document.`/`window.`/`localStorage`/`navigator.`
  across `lib/` returns nothing, and the validator enforces it for `lib/`
- Old-code-first discipline followed: the existing suite was repointed at
  `lib/m3u.js` and passed **before** any line was deleted from `utils.js`

**Decisions**
- **`utils.js` keeps its remaining exports and is NOT deleted.** MIGRATION.md
  §1 says `utils.js` is deleted once `lib/` is complete — that is correct, but
  the network layer (`fetchPlaylist*`) has DOM/`fetch` dependencies and no
  `lib/` home yet. It stays until T-113/T-114 finish the extraction.
- **`parseM3u` stayed reachable from `utils.js`.** Re-pointing the three call
  sites (`main.js`, `settings.js`, `ui.js`) was unnecessary: only `main.js`
  uses the playlist API, and the other two import `escapeHtml`. `utils.js`
  now re-imports `parseM3u` for `fetchPlaylist` internally, so nothing
  outside had to change.
- **Test expansion accepted as separate work.** T-110's own bar (≥30 tests
  covering the moved code) is met at 86 total / 25 new. T-111 and T-112's
  per-module bars (≥20 and ≥15 colocated tests) are **not** met and are left
  open on those tickets rather than claimed.

**Watch out**
- **T-110 could not have landed alone.** `parseM3u` depends on
  `extractAuthQuery` and `parseLicenseKeyValue`, so moving it first would put
  `lib/m3u.js` and `utils.js` in an import cycle — which `npm run validate`
  rejects. The three leaf modules had to move together. Anyone sequencing
  T-111/T-112 before T-110 in the ticket list should read this first.
- **`lib/` is scanned by the modularity guard, including test files.**
  `walk()` recurses and matches every `.js`, so `lib/*.test.js` must stay
  DOM-free too. Fine today, worth knowing before writing a lib test that
  reaches for `document`.
- **A bundle hash change is expected here.** The old hash was
  `index.4Ng0uPJB.js`; the split produces `index.DZXs08fz.js` for a 6-byte
  difference. Do not treat a hash change as a regression when a refactor
  crosses a module boundary — compare sizes, not names.
- `git stash` around a rebuild is the reliable way to get a before/after
  comparison; `npm run build` rewrites `dist/`, so build order matters.

**Next**
- **T-111** — add colocated `lib/url.test.js` (≥20 tests, including the
  `data:` license-URI regression from BUG-013) and move the `withAuthQuery` /
  `redactUrl` assertions out of `utils.test.js`.
- **T-112** — colocated `lib/drm.test.js` (≥15), covering all three
  `license_key` forms plus rejections.
- Then **T-113** (`lib/time.js` from `settings.js`) and **T-114**
  (`lib/capabilities.js`), which close out M1.

---

## 2026-11-16 — Phase 0 closed: audit clean, CI gates merges, stale plan retired — @maintainer

**Ticket:** T-100, T-106 (plus T-107 status correction, `FILE_SPLIT_PLAN` cleanup)
**Branch:** `chore/t-106-audit-fixes` → `dev`
**Status:** ✅ Phase 0 complete — Phase 1 is unblocked

**What changed**
- **T-100 — CI now actually gates `dev`.** The workflow already existed and
  was green; what was missing was the enforcement. Enabled branch protection
  on `dev` requiring both checks (`Test · Lint · Build · Modularity`,
  `WGT packaging`), with no required reviewers (solo project), and
  force-push/deletion blocked. Verified by reading the protection API back.
- **T-106 — 0 vulnerabilities.** `npm audit fix`: vite 6.3.5 → 6.4.6,
  source-map-js 1.2.1 → 1.2.2, vitest 5.0.2 → 5.1.0, eslint 10.11 → 10.15.
  All advisories were dev-server/test-runner only and none ship in the WGT.
- **`docs/FILE_SPLIT_PLAN.md` resolved.** It described the abandoned v1.3
  four-phase approach with stale LOC (claimed `ui.js` 838, actually 1464) and
  contradicted `docs/MIGRATION.md`. Replaced with a short superseded-pointer
  that maps each file to its real v4 ticket. `docs/BUGS.md` (BUG-002) and
  `docs/ROADMAP.md` item 6 now point at `MIGRATION.md` instead.
- **`docs/TICKETS.md`** — T-100, T-106 marked done with evidence; T-107
  corrected to committed (`cb9ccbe`) — it was recorded as "in progress,
  needs a commit" but had in fact already landed.
- **`AGENTS.md` — new §0 "Non-negotiables".** The five rules that have each
  already been broken once (mint-a-key, commit-to-main, no session entry,
  commit format, the four gates) are now at the top of the file instead of
  buried in §5, each tagged with what enforces it.

**Verified**
- `npm test` → 61 passed, 4 files
- `npm run lint` → clean
- `npm run validate` → 15 files, 0 new violations, 8 baselined
- `npm run build` → ok, **bundle byte-identical** to pre-upgrade
  (`index.4Ng0uPJB.js`); size gate 931.2 KB = 82.7 % of the 1126 KB budget
- `npm audit` → 0 vulnerabilities
- `gh api …/branches/dev/protection` → both contexts required, force-push
  and deletion disabled

**Decisions**
- **Branch protection only on `dev`, not `main`.** `main` receives a merge
  from `dev` that is already gated, so a second gate there adds a step
  without adding information. Revisit if `main` ever takes a direct commit.
- **`required_pull_request_reviews: null`** — deliberately no reviews, per
  `docs/BRANCHING.md` §1 (solo, no PRs). The protection is about CI, not
  about a second pair of eyes.
- **Deleted `FILE_SPLIT_PLAN.md`'s content rather than the file.** Old links
  in `BUGS.md`/`ROADMAP.md`/the session log still resolve, and the original
  is recoverable from git history — the pointer says how.
- **`npm audit fix`, not `--force`.** Nothing needed a breaking major bump;
  the whole set resolved within existing semver ranges.

**Watch out**
- **A `--dry-run` audit is not a fix.** `npm audit fix --dry-run` printed the
  same 7 vulnerabilities and still exited non-zero; only the real run cleared
  them. Do not read the dry-run output as failure.
- Vitest moved 5.0.2 → 5.1.0 and eslint 10.11 → 10.15 as a side effect of
  the audit fix. Both are minor bumps and the suite is green, but if a test
  behaves oddly later, that pair is the first thing to suspect.
- `npm warn allow-scripts` mentions `esbuild@0.25.12` on every install. That
  is npm's script-approval prompt, not a vulnerability — it does not appear
  in `npm audit`.
- Branch protection does **not** block a direct push to `dev` from a
  maintainer who bypasses checks unless `enforce_admins` is on. It is off by
  design (you are the only admin); the gate protects against accident, not
  against you.

**Next**
- **Phase 1 starts at T-110 (`lib/m3u.js`)** — `utils.js` is the smallest
  baselined violation (348 LOC) and `parse-m3u.test.js` already covers the
  four target functions, so the split has a real characterisation net.
  Order: T-110 → T-111 → T-112 → T-113 → T-114.
- Then T-129 (shared `player/state.js`) **before** T-120, per the migration
  guide's warning that a naive `player.js` slice duplicates module state.

---

## 2026-11-15 — migration guide for the v4 restructure — @maintainer

**Ticket:** T-105 (docs), plus new T-129 / T-153 / T-181
**Branch:** `dev`
**Status:** ✅ done — the plan now answers "what happens to the old files?"

**What changed**
- **`docs/MIGRATION.md`** (new) — the answer to "what happens with the
  existing long files": each large file is *sliced*, the slices keep their
  names, and a thin **re-export hub** preserves the old public API so every
  call site keeps working untouched. No logic is rewritten during the move;
  feature work happens afterwards in separate commits, where a regression is
  easy to bisect.
- **Found and documented three real risks** the plan had not covered:
  - **A — the release script breaks.** `scripts/release.mjs` reads
    `player/src/main.js` and requires the in-app "What's New" entry. M5
    empties `main.js` into `app/`, which would abort the release. New ticket
    T-153, landing in the same commit as the move.
  - **B — user settings lost.** v4 adds `movies`, `favorites`, `features`
    keys to `en_settings`. New ticket T-181: additive, idempotent migration
    with a `schemaVersion` field, unit-tested, and the `en_settings` key
    name never changed.
  - **C — module state splits badly.** `ui.js` has 21 module-level
    variables shared by every function; slice it naively and each slice
    gets its own copy and the UI silently stops working. New ticket T-129
    (player) and T-130 (ui) extract the shared state **before** the split.
- **`scripts/validate-modularity.mjs`** — closed a loophole found while
  writing the guide: a re-export hub (`export * from './x.js'`) counted as
  **0 exports**, so a hub could hide a 74-export API past the limit. The
  export rule now resolves the **public surface transitively**; pure hubs
  are exempt, but the slices they point at are not. Verified with an
  injected 40-export leaf (caught) and a pure hub (allowed).
- `docs/TICKETS.md` — T-129, T-153, T-181 added; the reactive-store
  cross-reference corrected from T-160 to T-170.
- `AGENTS.md` and `docs/v4.PLAN.md` link the migration guide.

**Verified**
- Confirmed the coupling is real and bounded: `player/index.html` references
  `/src/main.js` (the entry point stays), `scripts/release.mjs` references
  `player/src/main.js` (the one path that must move, now ticket T-153),
  `scripts/metrics.mjs` and the baseline reference paths generically.
- Confirmed **only `main.js` has top-level side effects**
  (`applyResponsiveScale()` and the `DOMContentLoaded` bootstrap) — every
  other file is side-effect free at import time, so slicing cannot change
  execution order.
- Confirmed `main.js` exports exactly one symbol (`refreshChannels`).
- The export-rule fix was tested with an injected violation and the files
  restored afterwards.

**Decisions**
- **The hub re-exports; the slices own the names.** A name is declared in
  exactly one slice and re-exported by the hub. Declaring it twice is a
  silent shadowing bug, so the guard resolves surfaces transitively.
- **`main.js` is never deleted** — it stays as the entry point, emptied to
  ~40 LOC. Every other large file is deleted in the *same commit* that
  creates its replacement, so a half-done split is never a possible state.
- **The old history is not rewritten** (that rule already applied to commit
  messages) — and the same reasoning applies to source files: the split
  moves code, it does not reformat it, so a revert is clean.

**Watch out**
- The v4 restructure is **invisible to users**. The shipped WGT is still one
  bundle with one entry point; only the source layout changes. The only
  user-visible difference in v4.0.0 is the new features.
- `npm run format:check` will start failing on the new slices until they are
  formatted — that is expected during a phase, and the pre-commit hook
  formats on commit.

**Next**
- Phase 0 remainder: enable "require status checks" on `dev` (T-100); fix the
  audit findings (T-106); resolve `docs/FILE_SPLIT_PLAN.md`.
- Phase 1: extract `lib/` modules with tests (T-110…T-114) — `lib/m3u.js`
  first, since it is the largest and the tests already exist.

---

## 2026-11-15 — commit message format, enforced by hook — @maintainer

**Ticket:** T-209 ✅
**Branch:** `dev`
**Status:** ✅ done

**What changed**
- **`scripts/check-commit-msg.mjs`** — validates the commit header format, a
  closed list of types and scopes, the ticket reference, the body, subject
  rules (lowercase start, no trailing period, no double spaces, no
  WIP/TODO/FIXME, no junk subjects), the 72-character header limit and the
  trailers (`Closes:`, `Refs:`, `BREAKING CHANGE:`).
- **`.husky/commit-msg`** — wires it in, so a non-conforming message is
  rejected at commit time rather than discovered later.
- **`docs/COMMIT_STYLE.md`** — the rules, the type/scope tables and worked
  examples, including a table of rejected messages with the reason each was
  rejected.
- `npm run lint:commits` — audits the existing history against the same
  rules.
- `scripts/release.mjs` — its own two commits now conform
  (`chore(release): publish vX.Y.Z`, `docs(stats): refresh download stats
  for vX.Y.Z`), so a release cannot trip its own hook.
- `AGENTS.md` and `docs/BRANCHING.md` updated to point at the style guide.

**Verified**
- Every rejection path tested and confirmed to fire: missing scope, unknown
  type, unknown scope, missing ticket, missing body, trailing period,
  uppercase subject, junk subject, over-long header, bad footer, `!` without
  a `BREAKING CHANGE:` footer.
- Valid messages accepted: `feat` with ticket and body, `chore` without a
  ticket, `merge` without a scope, a breaking change with its footer.
- **The hook was tested with real commits**: a bad message was rejected
  (exit 1), a good message committed cleanly (exit 0), with the `pre-commit`
  hook running alongside it.
- `npm run lint:commits` reports the real history: 191 commits checked, 171
  pre-date the convention.

**Decisions**
- **The scope list is closed.** Free-form scopes are how `misc`, `stuff` and
  `session`/`roadmap`/`readme` creep in. Every scope in the list is one
  worth grepping for, and adding one is a deliberate act.
- **The ticket reference lives in the subject**, not the body — so both
  `git log --oneline` and `git log --grep=T-123` find it. In the body it
  would only be found by the second.
- **Only behaviour-changing types require a body.** Forcing a body on every
  `docs` or `chore` commit trains people to write filler.
- **The old history is not rewritten.** Rewriting would change every SHA and
  break the release tags, for no benefit. The audit shows where the
  convention starts instead.
- The `merge` type exists so merge commits fit the format without needing a
  scope or a ticket; git's own "Merge branch…" messages are exempt.

**Watch out**
- The first commit after this lands must itself conform — the hook is live
  from this commit onward.
- `scripts/release.mjs` now depends on the hook accepting
  `chore(release): …` and `docs(stats): …`. If the scope list is edited
  later, keep those two or the release script breaks.

**Next**
- Phase 0 remainder: enable "require status checks" on `dev` (T-100); fix the
  audit findings (T-106); resolve `docs/FILE_SPLIT_PLAN.md`.
- Phase 1: extract `lib/` modules with tests (T-110…T-114).

---

## 2026-11-15 — release signing key restored, packager now guards it — @maintainer

**Ticket:** T-104 ✅, T-208 ✅
**Branch:** `dev`
**Status:** ✅ done — the release path is unblocked

**What changed**
- Restored the real signing key and certificate to `tizen/`. The certificate
  is confirmed as the one that signed **every** released WGT (v3.0.2 →
  v3.2.0), all with SHA-1 fingerprint
  `8F:73:83:29:93:CC:1E:13:16:AE:89:00:E0:AA:BD:5B:50:80:90:23`.
- **Added `tizen/author-cert.sha256`** — the expected certificate fingerprint,
  committed to the repo. The key itself stays gitignored; the fingerprint is
  public and proves a build carries the same app identity as every previous
  release.
- **`tizen/package.mjs` now refuses to build on a fingerprint mismatch** and
  aborts with both fingerprints. Key generation prints a loud warning instead
  of silently minting one.
- Docs updated: `docs/v4.PLAN.md` §8 (resolved + the new guard),
  `docs/TICKETS.md` T-104 and the new T-208.

**Verified**
- `openssl x509 -in tizen/author-cert.pem -noout -fingerprint -sha256` →
  `40:71:40:30:04:D9:49:25:55:68:FF:44:B8:36:47:35:22:52:89:61:E6:0F:BE:57:3A:9B:28:5B:7D:B7:51:43`
- The certificate matches all six released WGTs byte for byte.
- `openssl rsa -check` → `RSA key ok`.
- The private key's modulus matches the certificate's modulus (it is its pair),
  and a signature made with it verifies against the certificate.
- **A WGT built with the restored key carries a byte-identical signer
  certificate to the released v3.2.0** (853 bytes, identical) — end-to-end
  proof of the whole chain.
- **Guard tested both ways:** with the correct certificate the build succeeds;
  with a freshly generated wrong certificate `npm run tizen` exits **1** and
  refuses to build. The correct key was restored afterwards and re-verified.

**Decisions**
- The certificate fingerprint is committed, the key is not. That gives the
  repo a permanent, checkable statement of "which app identity is this" with
  no secret in git.
- The guard lives in the **packager**, not only in the release script, so it
  catches the mistake at the earliest possible moment — including a manual
  `npm run tizen` build.

**Watch out**
- The private key is on this machine and is gitignored. Keep the off-machine
  encrypted backup — it is still the only copy outside this disk.
- A private key can be damaged by a copy/paste slip. The copy that arrived
  here had two transposed characters, which OpenSSL rejects with
  `n does not equal p q`. If that ever happens: the certificate is still
  good, and the key can be reconstructed from the certificate's modulus plus
  the key's own primes — but the honest fix is to re-copy from the backup.
- **One-off build crash observed:** `vite build` exited **139** (SIGSEGV)
  once, mid-transform, and then succeeded on every retry (3/3 clean runs
  afterwards). Not caused by these changes — the bundle hash was identical
  before and after. Almost certainly the esbuild binary crashing under
  memory pressure (7.7 GB box, ~4.3 GB already in use at the time). If it
  recurs, run the build again; if it becomes frequent, check free memory
  before the build.

**Next**
- Phase 0 remainder: enable "require status checks" on `dev` (T-100); fix the
  audit findings (T-106); resolve `docs/FILE_SPLIT_PLAN.md`.
- Phase 1: extract `lib/` modules with tests (T-110…T-114).

---

## 2026-11-15 — v4 groundwork committed and CI-verified — @maintainer

**Ticket:** T-100, T-101, T-102, T-103, T-105, T-107
**Branch:** `chore/v4-planning` → merged into `dev` → pushed
**Status:** ✅ merged to `dev` (`cd809e6`)

**What changed**
- Committed the v4 groundwork as four logical commits on `chore/v4-planning`,
  merged `--no-ff` into `dev`, deleted the branch, pushed to `origin/dev`.
  - `fix(tooling)` — the two Linux portability fixes (proxy SHA-1, `nul` file)
  - `chore(lint)` — extended ESLint to `proxy/` and `tizen/`; this surfaced a
    dead `renameSync` import in `tizen/package.mjs`, now removed
  - `feat(tooling)` — CI workflow + the three guard scripts + the ratchet
    baseline
  - `docs(v4)` — the document set and the rewired existing docs
- Simplified the whole workflow for a **solo maintainer**: no pull requests, no
  reviewers. Direct merges into `dev`; `main` still only receives a tested
  release. Added an `experiment/` branch type for throwaway spikes and explicit
  AI-agent collaboration rules (branch, never `main`, never mint a signing key,
  always append to this log).
- Added a self-review checklist to `docs/BRANCHING.md` §6 — with no second
  pair of eyes, it is the gate that stands between a bad merge and users.
- Fixed AGENTS.md section numbering (two sections both numbered 4, no section
  11) — now runs 1–13 cleanly — and the stale `AGENTS.md §8` reference in
  `docs/ROADMAP.md`.
- Switched the `origin` remote from HTTPS to SSH. The HTTPS push failed with
  `could not read Username`; the SSH key was already present and working.

**Verified**
- `npm test` → 61 passed · `npm run lint` → clean · `npm run validate` → 0 new
  violations · `npm run build` → 953 KB · `npm run tizen` → signed WGT
- **CI ran on the real push and passed**: every step green —
  Unit tests · Lint · Modularity guard · Build · Bundle size gate ·
  Formatting check · WGT packaging + artifact upload
- The only non-zero step is `Formatting check`, which carries
  `continue-on-error: true` on purpose for the 8 known legacy files
- Working tree clean; `dev` is 8 commits ahead of `main`, `main` is 0 ahead of
  `dev` (nothing lost)

**Decisions**
- **CI runs on `push`, not only on pull requests.** With no PRs in this
  workflow, a `pull_request`-only workflow would never have run. The
  `pull_request` trigger is kept for the community-fork case.
- **The remote moved to SSH.** HTTPS push was broken in this environment;
  SSH worked immediately with the existing key. The remote URL is a local
  config change, not a repo change — nothing in the repo depends on it.
- **The self-review checklist is mandatory, not advisory.** Item 4 of the
  Definition of Done (`docs/v4.PLAN.md` §11) now requires it, and the merge
  rule states that a branch merges into `dev` only after items 1–4 are green.

**Watch out**
- **`tizen/author-key.pem` on this machine is still NOT the release key.**
  Minted locally 2026-11-11 by a test build; the released v3.2.0 WGT used a
  key from 2026-08-28 — SHA-256
  `40:71:40:30:04:D9:49:25:55:68:FF:44:B8:36:47:35:22:52:89:61:E6:0F:BE:57:3A:9B:28:5B:7D:B7:51:43`.
  **Restore it from the off-machine backup before any release** — a different
  key makes the TV treat the update as a new app and wipe every user's
  settings. Procedure: `docs/v4.PLAN.md` §8, ticket T-104.
- `main` has not received anything yet — that is correct. The next release
  merges `dev` → `main` and then runs `npm run release` from `main`.
- Branch protection is **not** enabled on `dev`. Without reviewers, enable
  only "require status checks to pass" — CI is green and ready to gate merges.
  Ticket T-100.
- `npm run format:check` still fails on 8 legacy files (pre-existing,
  deliberate). CI tolerates it; the pre-commit hook formats them on touch.
- `npm audit`: 2 high (vite ≤6.4.3, source-map-js) + 5 moderate. Dev-server
  only. Ticket T-106.
- `docs/FILE_SPLIT_PLAN.md` still describes the old v1.3 split approach and is
  superseded by `docs/v4.PLAN.md` M1–M5 — update or delete it so two plans
  do not disagree.
- `origin/fix/segment-404-reload` is a stale remote branch from an old fix —
  safe to delete.

**Next**
- Phase 0 remainder: restore the signing key (T-104); enable "require status
  checks" on `dev` (T-100); fix the audit findings (T-106); resolve
  `docs/FILE_SPLIT_PLAN.md`.
- Phase 1: extract `lib/` modules with tests (T-110…T-114) — `lib/m3u.js`
  first, since it is the largest and the tests already exist.

---

## 2026-11-15 — v4 plan, environment setup, CI + modularity guard — @maintainer

**Ticket:** T-105 (docs), T-107 (toolchain fixes), T-100/T-101/T-102/T-103
**Branch:** `main` → working tree
**Status:** 🔄 in progress — everything below is uncommitted

**What changed**

*Documentation set (new)*
- `docs/v4.PLAN.md` — master plan: goals + measurable criteria, measured
  baseline, target architecture, 11 phases (M0–M10) with entry/exit criteria,
  dependency order, CI gates, 11-item risk register, release cadence, DoD.
- `docs/TIZEN_COMPAT.md` — measured platform matrix (§5 has the re-verify
  commands).
- `docs/BRANCHING.md` — branch model, versioning, release flow, migrations,
  self-review checklist.
- `docs/SESSION_LOG.md` — this file.
- `docs/CONTRIBUTING.md` — setup, workflow, testing, TV verification.

*Documentation set (rewritten)*
- `docs/TICKETS.md` — v4 backlog (T-100…T-203) with spec + acceptance
  criteria per ticket; v1–v3 history preserved.
- `docs/ROADMAP.md` — points at the v4 plan; Tizen 4 recorded as ruled out.
- `docs/REPO_RULES.md` — reduced to a pointer (it contradicted BRANCHING.md on
  the community-bundle PR).
- `AGENTS.md` — doc index, branch policy, remote keys, Tizen floor, DoD,
  modularity guard, session-log rule.
- `README.md` — CI badge; limitations now state the Tizen 5.0 floor.
- `CHANGELOG.md` — `## [Unreleased]` section added (the release script aborts
  without it).

*Tooling (new)*
- `scripts/validate-modularity.mjs` — enforces LOC ≤ 300, exports ≤ 15, no
  circular imports, DOM purity in `logic.js`/`lib/`, no `console.log`.
  Uses a **ratchet**: `scripts/modularity-baseline.json` records the 8 known
  v3.2.0 violations; CI fails only on *new* ones. `--strict` / `--update`.
- `scripts/metrics.mjs` — LOC table, over-limit list, bundle size, test count.
- `scripts/check-bundle-size.mjs` — 1.1 MB budget gate.
- `.github/workflows/ci.yml` — test → lint → validate → build → size gate →
  WGT packaging + artifact upload.

*Tooling (fixed)*
- `proxy/proxy.mjs` — `selfsigned` defaults to SHA-1; OpenSSL 4 rejects it
  (`invalid digest`) and the relay crashed at startup. Now `sha256`.
- `tizen/package.mjs` — `2>nul` is a Windows redirect; on Linux it created a
  file literally named `nul`. Now platform-aware.

**Verified**
- `npm test` → 61 passed (4 files)
- `npm run lint` → clean
- `npm run validate` → 0 new violations (8 tracked in the baseline)
- `npm run build` → 953.50 KB, 3.7 s; `npm run metrics` → 931.2 KB on disk
- `node scripts/check-bundle-size.mjs` → 82.7 % of budget, under
- `npm run tizen` → signed WGT, 469 KB; contents verified (8 entries,
  `signature.xml` last, `icon.png` 512×423)
- `npm run proxy` → starts, cert generated, banner shown
- **Guard tested against real violations:** injected a `console.log` (caught),
  injected a circular import (caught, cycle path printed), injected a new
  export (caught) — then restored the files
- CI YAML parsed with PyYAML → 2 jobs
- New scripts pass `prettier --check`

**Decisions**
- **Tizen 4.0 is ruled out — Tizen 5.0 is the floor.** Measured, not guessed:
  the bundle parses at `ecmaVersion 2015` (0 native `await`, 0 classes, 0 real
  optional chaining — the `?.` strings in the bundle are ternary `? .1`), so
  syntax is *not* the blocker. The blocker is Shaka Player 5.x's dependency on
  `Proxy` (Chromium 49) against Tizen 4's Chromium 47; `Proxy` cannot be
  meaningfully polyfilled. The alternative — native AVPlay only — would drop
  ClearKey/PlayReady, the app's headline feature. Evidence + re-measure
  commands: `docs/TIZEN_COMPAT.md`.
- **Corrected an earlier assumption:** "Tizen 4 has no ES modules" was wrong.
  The build emits one IIFE and the Vite plugin strips `type="module"`, so
  there is no runtime ES-module dependency at all.
- **The plugin registry must use `import()` with `inlineDynamicImports: true`.**
  Verified: Rollup *rejects* dynamic import under `format: 'iife'`
  ("UMD and IIFE output formats are not supported for code-splitting builds").
  With `inlineDynamicImports: true` the build succeeds and no `import()` is
  left in the output. A future switch to `format: 'es'` makes real lazy chunks
  free.
- **The modularity guard ships as a ratchet, not a hard gate.** A hard gate
  would fail every build on day one (8 pre-existing violations) and get
  disabled within a week. The ratchet blocks regressions and shrinks as the
  phases land.
- **VOD scope is direct URLs + user-controlled JSON/M3U manifests, not a
  shipped scraper.** Archive.org and similar pages are not CORS-readable from
  the TV, and page scrapers break whenever the site changes. The native AVPlay
  path ignores CORS, so direct URLs that the browser stack refuses can still
  play.
- **`docs/REPO_RULES.md` was reduced to a pointer** rather than kept in sync —
  it directly contradicted `BRANCHING.md` on the community-bundle PR, and two
  copies of a rule is exactly how contributors follow the wrong one.
- **Workflow simplified for a solo maintainer (later in the same day).** The
  first draft assumed contributors and pull requests. Rewritten: no PRs, no
  reviewers, direct merges into `dev`. What was **kept** is the part that
  protects users — `main` stays releasable, `dev` stays green, the
  self-review checklist, and CI as the one gate that runs when you forget to
  check. Added `experiment/` for throwaway spikes and explicit AI-agent
  collaboration rules.

**Watch out**
- **All of the above is uncommitted on `main`.** The release script requires a
  clean tree, so this must be committed before any release.
- **`tizen/author-key.pem` on this machine is NOT the release key.** It was
  minted locally on 2026-11-11 by a test build. The released v3.2.0 WGT was
  signed with a key created 2026-08-28 — SHA-256
  `40:71:40:30:04:D9:49:25:55:68:FF:44:B8:36:47:35:22:52:89:61:E6:0F:BE:57:3A:9B:28:5B:7D:B7:51:43`.
  **Restore the real key from the off-machine backup before shipping
  anything** — a different key makes the TV treat the update as a new app and
  wipe every user's settings. Procedure: `docs/v4.PLAN.md` §8, ticket T-104.
- `npm run format:check` still fails on 8 legacy files (`avplay.js`,
  `remote.js`, `settings.js`, `styles.css`, `utils.js`, `xtream.js`, 2 test
  files). Pre-existing and deliberate — legacy files are formatted on touch,
  never in a big-bang reformat. CI runs the prettier check with
  `continue-on-error` for the same reason.
- `npm audit`: 2 high (vite ≤6.4.3, source-map-js) + 5 moderate. Dev-server
  only — not shipped to TVs. Ticket T-106.
- `docs/FILE_SPLIT_PLAN.md` still describes the old v1.3 split approach. It is
  superseded by `docs/v4.PLAN.md` M1–M5 — update or delete it to avoid two
  plans disagreeing.
- `origin/dev` is 1 commit ahead of `origin/main` (a README honesty merge).
- Branch protection is **not** enabled on `main`/`dev`. Without a second
  reviewer, enable only "require status checks to pass" (no required
  reviews) — that makes CI a real gate on merges to `dev`. Ticket T-100.

**Next**
- Commit everything on `chore/v4-planning`, merge into `dev`.
- Phase 0 remainder: enable "require status checks" on `dev`; fix the audit
  findings (T-106); restore the signing key (T-104); update or delete
  `docs/FILE_SPLIT_PLAN.md`.
- Phase 1: extract `lib/` modules with tests (T-110…T-114).

---

## Older history

Pre-v4 work is recorded in the git history (`git log --oneline`) and in
`CHANGELOG.md` (user-facing) and `docs/BUGS.md` (defect history). This log
starts at the v4 planning session, 2026-11-15.
