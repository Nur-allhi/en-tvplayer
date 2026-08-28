# TICKETS — EN TV Player

> **Version:** 1.0 · **Date:** 2026-08-28
> **Rule:** One ticket = one branch = one merge. Atomic.

---

## Milestone v1.2.0 — "Daily Driver"

### T-001: Remember last channel
- **Skills:** `senior-frontend`
- **Spec:** Persist `lastChannelIndex` on every successful load; boot plays it directly
- **Acceptance:** Restart resumes same channel; boot→video ≤3s from cache
- **LOC:** ≤ 40

### T-002: Favorites + recents
- **Skills:** `senior-frontend`
- **Spec:** Red-key toggle on current channel; `favorites: url[]` in localStorage; "Favorites" pinned group at top
- **Acceptance:** Favorite persists across restart; groups list shows pinned section
- **LOC:** ≤ 150

### T-003: Info bar with clock
- **Skills:** `senior-frontend`
- **Spec:** Extends OSD: number, name, group, format, resolution, clock; 8s auto-hide
- **Acceptance:** Shows on channel change; hides per timer
- **LOC:** ≤ 120

---

## Milestone v2.0.0 — "Real TV Experience"

### T-010: Now/next mini-EPG (XMLTV)
- **Skills:** `senior-backend` + `senior-frontend`

### T-011: Audio/subtitle track menus
- **Skills:** `senior-frontend`

### T-012: Parental lock (PIN group)
- **Skills:** `senior-frontend` + `code-reviewer`

---

**Sequencing:** T-001 → T-002 → T-003 → v1.2.0 release
