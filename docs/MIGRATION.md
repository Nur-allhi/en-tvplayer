# MODULAR MIGRATION — what happens to the existing large files

> **Status:** authoritative for the v4 restructure. **Date:** 2026-11-15.
> **Companion:** `docs/v4.PLAN.md` (the plan) · `docs/TICKETS.md` (the work)
>
> The short answer: **nothing is thrown away, and nothing breaks.** Each
> large file is *sliced*, the slices keep their old names, and a thin
> **re-export hub** preserves the old import path so every caller keeps
> working untouched. That is the whole trick.

---

## 1. The four big files, and where their contents go

| Today | Becomes | Fate of the original |
|--------|---------|----------------------|
| `player.js` (1669 LOC, 24 exports) | `player/` — 6 modules + `index.js` hub | **deleted** after the split; `import … from './player/index.js'` |
| `ui.js` (1463 LOC, 74 exports) | `ui/` — 7 modules + `index.js` hub | **deleted** after the split |
| `settings.js` (1066 LOC, 8 exports) | `settings/` — 5 modules + `index.js` hub | **deleted** after the split |
| `main.js` (1587 LOC) | `main.js` (thin, ~40 LOC) + `app/` — 5 modules | **kept** as the entry point, emptied |
| `utils.js` (347 LOC) | `lib/` — 5 modules | **shrunk, not deleted** — see below |
| `styles.css` (1771 LOC) | `styles/` — 7 files | **split**; `main.js` imports `styles/index.css` |

> **`utils.js` correction (T-110, 2026-11-16).** It is **not** deleted. The
> pure helpers moved to `lib/` (`m3u.js`, `url.js`, `drm.js`), taking it from
> 347 to 66 LOC, but the network layer (`fetchPlaylist`,
> `fetchPlaylistEntry`, `fetchPlaylistWithRetry`) and `escapeHtml` stayed:
> they touch `fetch`/`document` and have no `lib/` home. `lib/` is DOM-free by
> rule (`npm run validate` enforces it), so the network code cannot go there.
> The module keeps its public surface, so `main.js`, `settings.js` and `ui.js`
> needed no change.

**No line of logic is rewritten during the move.** The split is a *move*,
verified by the build and the test suite. Feature work happens afterwards,
in separate commits, where a regression is easy to bisect.

---

## 2. The re-export hub — why callers never notice

Before (`main.js` does `import * as player from './player.js'`):

```js
// player.js — 1669 lines, everything in one file
export function initPlayer() { … }
export async function loadChannel() { … }
// … 22 more exports
```

After — the same six files exist, but sliced:

```
player/
├── index.js        ← the hub: the public API, unchanged
├── init.js         ← initPlayer, destroyPlayer
├── load.js         ← loadChannel, reloadChannel
├── events.js       ← onBuffering, onTrackChange, …
├── recovery.js     ← handlePlayerError, scheduleReconnect, …
├── stream.js       ← getResolutions, selectResolution, …
└── avplay.js       ← moved verbatim
```

`player/index.js` is the whole public surface in a few lines:

```js
// player/index.js
export * from './init.js';
export * from './load.js';
export * from './events.js';
export * from './recovery.js';
export * from './stream.js';
export * from './avplay.js';
```

A caller that wrote `import { loadChannel } from './player/index.js'` gets
exactly the same function it got before. **Every import site in the app
keeps working.** That is why the split can be done in one commit per
module with no behavioural risk.

### The rule that makes this safe

> **The hub re-exports names; the slices own them.** A name is *declared* in
> exactly one slice and *re-exported* by the hub. Never declare the same
> name twice — that is a silent shadowing bug.

The modularity guard enforces the sibling of this rule: the ≤ 15 exports
limit applies to the **public surface** of a file, counting re-exports
transitively. A pure hub is exempt, but the slices it points at are not —
so a hub cannot be used to smuggle a 74-export API past the limit.

---

## 3. Why this order

The slices are extracted **from the top down**, and each phase ends with the
app fully working:

| Phase | Slices | Public API after |
|-------|--------|------------------|
| M2 | `player.js` → `player/` | 24 names, identical |
| M3 | `ui.js` → `ui/` | 74 names, identical |
| M4 | `settings.js` → `settings/` | 8 names, identical |
| M5 | `main.js` → `main.js` + `app/` | 1 name, identical |

Each phase is one ticket, one branch, one commit. If a phase goes wrong,
`git revert` that one commit and you are back to a working app. **You are
never in a state where the app is half-migrated.**

### The verification per phase

```bash
npm test                    # behaviour unchanged
npm run build               # still builds
npm run validate            # modularity rules hold
node scripts/metrics.mjs    # confirm the LOC actually came down
```

Plus the manual remote checklist from `docs/TIZEN_GUIDE.md` — the flows
that unit tests cannot reach (focus rings, key handling, the boot sequence).

---

## 4. The three risks this plan handles explicitly

### Risk A — the release script breaks

`scripts/release.mjs` reads **`player/src/main.js`** and checks that it
contains `version: '<base>'` — the in-app "What's New" entry. When
`main.js` is emptied in M5, that read finds nothing and **the release
aborts**.

**Fix (M5, same phase):** move the in-app changelog to
`player/src/app/changelog.js` and update `release.mjs` to read the new
path. Both land in the same commit, so the release path is never broken
in between.

### Risk B — user settings are lost

v4 adds `movies`, `favorites` and `features` keys to the `en_settings`
object. The migration is **additive only** — existing keys are never
removed, renamed or reshaped, so a v3 install reads fine under v4.

**Fix (M8, before the VOD feature):** add a `schemaVersion` field and a
migration function in `config.js`:

```js
// v3 → v4: additive, idempotent, never deletes
if (!s.schemaVersion || s.schemaVersion < 4) {
  s.movies = s.movies || [];
  s.favorites = s.favorites || [];
  s.features = s.features || { favorites: true, infoBar: true, vod: true };
  s.schemaVersion = 4;
  dirty = true;
}
```

Rules (also in `docs/BRANCHING.md` §5): additive only · idempotent ·
unit-tested · **never change the `en_settings` key name** — that would
orphan every existing install.

### Risk C — module-level state splits badly

`ui.js` has 21 module-level variables (`channels`, `currentIndex`,
`sidebarOpen`, `rightResolutions`, …) shared by every function in the
file. Split the file naively and each slice gets its own copy — the UI
silently stops working.

**Fix (M3, first slice):** extract `ui/state.js` **before** splitting, so
all slices import one shared state object. And do **not** convert to the
reactive store in the same phase — that is M7, a separate ticket, so a
failure has one cause.

`player.js` and `settings.js` have the same pattern and the same fix.

**Done for `player.js` (T-129, 2026-11-16).** It was **45** shared bindings, not
21 — the estimate was low by more than half. They now live in
`player/src/player/state.js` as properties of one exported object, with
`player.js` referencing them as `state.<name>`. Verified: 196 tests, bundle
+0.69 % (inside the ±2 % budget), no behaviour change.

Two lessons worth carrying into T-130:

1. **Do the rename with a real parser.** A regex or a hand-written scanner
   cannot tell a regex literal from division, and `player.js` contains
   `/…[^\s'"]+?…/` — my scanner silently produced **zero** renames because the
   quote characters inside that literal desynced it. Parsing with `acorn` and
   editing by node range is what actually worked.
2. **Do not invent a "reset all state" helper while you are in there.** The
   five reset sites in `loadChannel` restore different subsets of the counters.
   Merging them would have changed behaviour inside a commit claiming to be a
   pure move. Move the state; leave the reset logic exactly where it was.

---

## 5. What is safe to delete, and when

| Item | When |
|------|------|
| `player.js` | M2, in the same commit that creates `player/` |
| `ui.js` | M3, same commit |
| `settings.js` | M4, same commit |
| `utils.js` | M1, once `lib/` has the tests |
| `styles.css` | M6, once `styles/` is imported |
| `main.js` | **never** — it stays as the entry point |

**Never delete a file in a different commit from the one that creates its
replacement.** A half-done split is the one state where the app is broken
and the cause is hard to see.

---

## 6. The app the user sees

**None of this is visible.** The WGT that ships is still one file with one
entry point. The split is internal structure:

```
v3.2.0 WGT:  index.html + one bundle        ← what the TV runs
v4.0.0 WGT:  index.html + one bundle        ← identical, just built from
                                                tidier source
```

The bundle is a single IIFE either way (`output.format: 'iife'`), so there
is no extra network request, no chunk loading, and no change in startup
behaviour. The only user-visible difference in v4.0.0 is the **new
features** — not the refactor.

---

## 7. Answering the question directly

> *"What will happen with our existing longer files?"*

They get **sliced into focused modules**, with their content preserved
line-for-line. The original files are deleted **only after** their slices
exist and are verified, always in the same commit. Any code that imported
them keeps working through a re-export hub, so **no caller changes** and
**no logic is rewritten**.

> *"What about these in our plan?"*

Yes — `docs/v4.PLAN.md` M1–M5 covers the slicing, `docs/TICKETS.md`
T-110…T-152 covers the individual slices, and the ratchet in
`scripts/modularity-baseline.json` shrinks with each one. What was
**missing** and is now documented here: the release-script coupling
(Risk A), the settings migration (Risk B), and the shared-state extraction
(Risk C).

---

## 8. Change log

| Date | Change |
|------|--------|
| 2026-11-15 | Initial migration guide. Documents the re-export hub strategy, the three risks (release-script coupling, settings migration, shared module state) and their fixes. |
