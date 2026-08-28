# BUGS — EN TV Player (Bug Tracker)

> Log bugs immediately. Never delete entries. Resolved bugs move to bottom.

---

## BUG-001: Debug console.log statements in production code

- **Status:** fixed
- **Severity:** medium
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/main.js:69,71,207,217`
- **Description:** Multiple `[DEBUG]` console.log statements left in production code. These leak internal state to users and clutter the console.
- **Expected:** No debug logs in production builds.

---

## BUG-002: Files exceed 300 LOC limit

- **Status:** deferred (too risky without tests)
- **Severity:** medium
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** Multiple files
- **Description:** Several files exceed the 300 LOC limit defined in AGENTS.md:
  - `main.js` — 665 LOC
  - `player.js` — 610 LOC
  - `settings.js` — 713 LOC
  - `ui.js` — 838 LOC
- **Expected:** Each file ≤ 300 LOC.
- **Resolution:** Deferred due to tight coupling and lack of tests. Splitting would risk breaking the app. See docs/FILE_SPLIT_PLAN.md for future reference.

---

## BUG-003: Excessive proxy debug logging

- **Status:** open
- **Severity:** low
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/player.js:66,70,76`
- **Description:** Verbose proxy logging (`[PROXY] SKIP`, `[PROXY] PROC`) in production. Leaks URL information.
- **Expected:** Minimal or no logging in production.

---

## BUG-004: Unimplemented feature (TODO)

- **Status:** fixed
- **Severity:** low
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/main.js:573`
- **Description:** `// TODO T-021: toggle favorite` — Favorite toggle not implemented but Red key is documented as "Favorite toggle".
- **Expected:** Either implement or remove from documentation.

---

## BUG-005: innerHTML usage without escapeHtml

- **Status:** closed (not an issue)
- **Severity:** medium
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/main.js:20,154,158`
- **Description:** Some innerHTML assignments use static strings (safe), but pattern is inconsistent. Should use textContent where possible.
- **Resolution:** All user content is already escaped with `escapeHtml()`. innerHTML usages are either static strings, HTML entities for icons, or properly escaped user content. No security issue found.

---

## BUG-006: Missing error handling in tizen key registration

- **Status:** fixed
- **Severity:** low
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/main.js:362`
- **Description:** `try { window.tizen.tvinputdevice.registerKey(key); } catch (e) {}` — Silent catch with no fallback.
- **Expected:** Log warning or handle gracefully.

---

## BUG-007: No cleanup of event listeners on destroy

- **Status:** fixed
- **Severity:** low
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/main.js` (multiple)
- **Description:** Event listeners added but never removed. Not critical for SPA but could cause issues if player is reinitialized.
- **Expected:** Cleanup function for event listeners.

---

## BUG-008: Playlist fetch fails on fresh install

- **Status:** fixed
- **Severity:** high
- **Found:** 2026-08-28 (user reported)
- **Location:** `player/src/main.js` — `showFirstLaunch()` callback
- **Description:** On fresh install, adding a playlist and clicking "Fetch Active" does nothing. The player never starts. User must force-close and reopen the app.
- **Root Cause:** `showFirstLaunch()`'s `onPlaylistFetched` callback calls `ui.stopInactivityTimer()` BEFORE `ui.init()` has been called. This throws an error that is silently caught by an empty `catch(e) {}` block. The fetch itself succeeds (channels saved to localStorage), but the player never starts.
- **Fix:** Removed premature `ui.stopInactivityTimer()` call. Added `console.error()` to catch block.

---

## Fixed Bugs

| Bug | Fixed | Commit |
|-----|-------|--------|
| BUG-008 | 2026-08-28 | fix/first-fetch-failure |
