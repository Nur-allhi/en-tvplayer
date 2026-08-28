# TICKETS — EN TV Player

> **Version:** 1.1 · **Date:** 2026-08-28
> **Rule:** One ticket = one branch = one merge. Atomic.

---

## Milestone v1.1.1 — "Bug Fixes"

### T-001: Remove debug console.log statements
- **Skills:** `senior-frontend`
- **Fixes:** BUG-001
- **Spec:** Remove all `[DEBUG]` console.log from `main.js`. Keep only error/warning logs.
- **Acceptance:** No debug output in browser console during normal use.
- **LOC:** ≤ 20

### T-002: Remove excessive proxy logging
- **Skills:** `senior-frontend`
- **Fixes:** BUG-003
- **Spec:** Remove `[PROXY] SKIP/PROC` logs from `player.js`. Keep only error logs.
- **Acceptance:** No proxy debug output in console.
- **LOC:** ≤ 15

### T-003: Fix documentation for unimplemented features
- **Skills:** `senior-frontend`
- **Fixes:** BUG-004
- **Spec:** Remove "Favorite toggle" from remote control docs until T-021 is implemented. Update README and AGENTS.md.
- **Acceptance:** Documentation matches actual features.
- **LOC:** docs only

### T-004: Add warning for tizen key registration failure
- **Skills:** `senior-frontend`
- **Fixes:** BUG-006
- **Spec:** Log warning when `registerKey` fails instead of silent catch.
- **Acceptance:** Warning appears in console if registration fails.
- **LOC:** ≤ 10

---

## Milestone v1.2.0 — "Daily Driver"

### T-010: Remember last channel
- **Skills:** `senior-frontend`
- **Spec:** Persist `lastChannelIndex` on every successful load; boot plays it directly
- **Acceptance:** Restart resumes same channel; boot→video ≤3s from cache
- **LOC:** ≤ 40

### T-011: Favorites + recents
- **Skills:** `senior-frontend`
- **Spec:** Red-key toggle on current channel; `favorites: url[]` in localStorage; "Favorites" pinned group at top
- **Acceptance:** Favorite persists across restart; groups list shows pinned section
- **LOC:** ≤ 150

### T-012: Info bar with clock
- **Skills:** `senior-frontend`
- **Spec:** Extends OSD: number, name, group, format, resolution, clock; 8s auto-hide
- **Acceptance:** Shows on channel change; hides per timer
- **LOC:** ≤ 120

---

## Milestone v1.3.0 — "Code Quality"

### T-020: Split main.js into modules
- **Skills:** `senior-frontend`
- **Fixes:** BUG-002 (partial)
- **Spec:** Split `main.js` (647 LOC) into `main.js` + `state.js` + `handlers.js`. Each ≤ 300 LOC.
- **Acceptance:** All files ≤ 300 LOC; behavior unchanged.
- **LOC:** net 0

### T-021: Split player.js into modules
- **Skills:** `senior-frontend`
- **Fixes:** BUG-002 (partial)
- **Spec:** Split `player.js` (613 LOC) into `player.js` + `stream.js`. Each ≤ 300 LOC.
- **Acceptance:** All files ≤ 300 LOC; behavior unchanged.
- **LOC:** net 0

### T-022: Split settings.js into modules
- **Skills:** `senior-frontend`
- **Fixes:** BUG-002 (partial)
- **Spec:** Split `settings.js` (713 LOC) into `settings.js` + `playlists.js`. Each ≤ 300 LOC.
- **Acceptance:** All files ≤ 300 LOC; behavior unchanged.
- **LOC:** net 0

### T-023: Split ui.js into modules
- **Skills:** `senior-frontend`
- **Fixes:** BUG-002 (partial)
- **Spec:** Split `ui.js` (838 LOC) into `ui.js` + `sidebar.js` + `osd.js`. Each ≤ 300 LOC.
- **Acceptance:** All files ≤ 300 LOC; behavior unchanged.
- **LOC:** net 0

### T-024: Consistent innerHTML safety
- **Skills:** `code-reviewer`
- **Fixes:** BUG-005
- **Spec:** Audit all innerHTML usage. Use textContent where possible, escapeHtml for dynamic content.
- **Acceptance:** No unescaped dynamic content in innerHTML.
- **LOC:** ≤ 50

---

## Milestone v2.0.0 — "Real TV Experience"

### T-030: Now/next mini-EPG (XMLTV)
- **Skills:** `senior-backend` + `senior-frontend`

### T-031: Audio/subtitle track menus
- **Skills:** `senior-frontend`

### T-032: Parental lock (PIN group)
- **Skills:** `senior-frontend` + `code-reviewer`

---

**Sequencing:** T-001 → T-002 → T-003 → T-004 → v1.1.1 release → T-010 → T-011 → T-012 → v1.2.0 → T-020..T-024 → v1.3.0
