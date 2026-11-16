# FILE_SPLIT_PLAN.md — superseded

> **Status:** ⛔ superseded 2026-11-15. Kept only so old links resolve.
> **Read instead:** `docs/MIGRATION.md` (how the split works) and
> `docs/v4.PLAN.md` §4 (`player`/`ui`/`settings`/`main` phases).

This document described the v1.3 approach to BUG-002 ("files over 300 LOC"):
four phases that rewrote `ui.js`, `settings.js`, `main.js` and `player.js`
into smaller modules by hand.

It was never executed, and the v4 plan replaced it for three reasons:

| v1.3 plan | v4 plan |
|-----------|---------|
| Split straight into the coupled files | Extract pure logic into `lib/` **first**, so tests exist before risky code moves |
| Rewrote code while moving it | Moves code only — no logic is rewritten during a split |
| Nothing enforced the result | `npm run validate` ratchets the debt: CI fails on new violations, the baseline only shrinks |
| Left `styles.css` and `utils.js` out | Both are in scope (`styles/`, `lib/`) |
| Manual "test after each phase" | Every slice lands with tests that were written against the **old** code first |

The LOC figures below were also stale — they were measured before several
feature branches landed (`ui.js` 838 → 1464, `main.js` 665 → 1588).

## Where the work actually lives now

| File today | Ticket | Destination |
|------------|--------|-------------|
| `utils.js` (348) | T-110…T-114 | `lib/` — 5 modules |
| `player.js` (1670) | T-120…T-123, T-129 | `player/` — 6 modules + hub |
| `ui.js` (1464) | T-130…T-136 | `ui/` — 7 modules + hub |
| `settings.js` (1067) | T-140…T-144 | `settings/` — 5 modules + hub |
| `main.js` (1588) | T-150…T-153 | `main.js` (thin) + `app/` |
| `styles.css` (1772) | T-160…T-164 | `styles/` — 7 files |

The current state of each is tracked by `npm run validate` and
`npm run metrics`; the ratchet baseline is `scripts/modularity-baseline.json`.

## Historical note

The original plan is preserved in git history:

```bash
git log --all --oneline -- docs/FILE_SPLIT_PLAN.md
git show <commit>:docs/FILE_SPLIT_PLAN.md
```
