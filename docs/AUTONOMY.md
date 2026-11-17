# AUTONOMY — unattended v4 ticket queue

> **Purpose:** a single, machine-readable queue so a night-shift agent can pick
> the next ticket without interpreting phase headings or guessing. If a ticket
> is not in this file, the agent does not work on it.
> **Owner:** maintainer. **Start here:** `.opencode/agents/nightshift.md`.
> **Command:** `/nightshift` (interactive only) · **Loop:** `.agents/loops/nightshift.md`
> **Task prompt:** [docs/NIGHTSHIFT_PROMPT.md](NIGHTSHIFT_PROMPT.md) — the loop
> and the live task must both use this plain text, never the slash command.

## OpenChamber setup — DONE 2026-11-16

All switches were set directly through the running OpenChamber 2.0.8 server on
port 3000. Nothing is left for the maintainer to toggle on this machine.

| Setting | Value |
|---|---|
| Task | `nightshift`, enabled |
| Schedule | cron `35 23 * * *` — **11:35 PM Bangladesh time**, TZ `Asia/Dhaka` (UTC+6) |
| Execution | plain-text prompt from `docs/NIGHTSHIFT_PROMPT.md` (see trap below), model `opencode/hy4-flash-free`, agent `nightshift` |
| Run as goal | `goalEnabled: true`, `goalTokenBudget: 400000` |
| Global goals | enabled, default budget 400000 |
| Question auto-delegate | enabled (backstop) |
| Permissions | `{ "action": "*", "resource": "*", "effect": "allow" }` in `.opencode/opencode.jsonc` |

Allow-all at the permission layer is deliberate: an unattended session has no
one to answer an `ask`. It cannot lift the `deny` policies — main, release,
tags, force-push and signing-key generation stay blocked.

**Verified:** `nextRunAt` = 2026-11-16 23:35 Dhaka (17:35 UTC),
`schedulerSynced: true`, both CI checks green on the last batch commit
`e2ebb1d`.

Keep the OpenChamber server alive overnight. Closing a tab is fine; quitting
the process pauses the schedule. `openchamber startup enable` survives logout.

These are machine-level settings, not committed files. On another machine,
repeat via the Scheduled Tasks and Settings UI: enable the `nightshift` loop,
set cron `35 23 * * *` / `Asia/Dhaka`, tick **Run as goal**, set a token budget.

Morning review: newest `docs/SESSION_LOG.md` entry,
`git log --oneline origin/dev..dev`, and CI on `dev`.

## Current state

```
BATCH_LIMIT = 3          # tickets per unattended run, to bound token spend
NEXT        = none        # T-150 partial, T-150b proposed — awaiting maintainer decision
MODE        = unattended # agent must not ask questions (task disabled by maintainer)
LAST_RUN    = 2026-11-17 # T-124 + T-125 + T-126 by night shift; T-127 manual
```

The agent updates `NEXT`, `LAST_RUN` and the `State` column after each ticket,
then commits those doc changes with the ticket's work.

## Stop conditions — any one ends the run

1. `BATCH_LIMIT` tickets processed.
2. Two consecutive tickets blocked.
3. Queue empty (`NEXT = none`).
4. `dev` CI red after three fix attempts.
5. Any step would require overriding a hard policy (main, release, signing key).

A goal is **not** complete while `dev` has a red check.

## Hard rules (also enforced by `.opencode/opencode.jsonc` policies)

- One ticket = one branch = one green merge to `dev`. Never commit to `main`.
- All gates before commit: `npm test`, `npm run lint`, `npm run validate`,
  `npm run format:check`; plus `npm run build` and `npm run tizen` before
  merging anything that touches `player/src`.
- `docs/SESSION_LOG.md` entry every ticket, newest first. This is the only
  handover — a session without one is unfinished.
- Commit messages: `<type>(<scope>): <subject> (T-###)`, ≤72 chars, body for
  `feat`/`fix`/`refactor`/`perf`. Message file goes in the OS temp dir.
- Never run `npm run release`, create a tag, or push anything but `dev`.
- Never mint, regenerate, overwrite or delete `tizen/author-key.pem`,
  `author-cert.pem` or `author-cert.sha256`.
- No TV is connected. Playback-behaviour changes get `needs-tv`, never a TV
  verification claim. Three retries per gate, then `blocked`.
- Leave `docs/REFINED_UX_REPORT.md` untouched — pre-existing user work.

## Queue

`ready` = pick up next. `done` = merged to `dev`, CI green, session log written.
`needs-tv` = merged and gated, hardware check still owed. `blocked` = recorded
with the exact gate output; agent skipped it.

| Order | Ticket | Scope | State | Depends / note |
|------:|--------|-------|-------|----------------|
| 1 | T-121 | M2 engine split — now an umbrella | done | re-scoped 2026-11-17; closed by T-124…T-127 |
| 2 | T-122 | `player/events.js` + `player/stream.js` | done | merged + gated 2026-11-16 |
| 3 | T-130 | `ui/state.js` | done | 18 shared vars moved (AST-measured); merged + gated 2026-11-16 |
| 4 | T-131 | `ui/dialogs.js` | done | zero imports; 74-name API intact; merged + gated 2026-11-16 |
| 5 | T-132 | `ui/osd.js` | done | z-index contract intact (CSS untouched); merged + gated 2026-11-16 |
| 6 | T-133 | `ui/sidebar.js` + `ui/search.js` | done | merged + gated 2026-11-17; deps registry added |
| 7 | T-134 | `ui/right-menu.js` | done | merged + gated 2026-11-17 |
| 8 | T-135 | `ui/core.js` + delete `ui.js` | done | merged + gated 2026-11-17; hub is 74 names |
| 9 | T-124 | `player/deps.js` — dependency registry | done | merged + gated 2026-11-17 |
| 10 | T-125 | pure helpers out of `loadChannel` | done | merged + gated 2026-11-17 |
| 11 | T-126 | `player/init.js` — init + destroy | done | merged + gated 2026-11-17 |
| 12 | T-127 | `player/load.js` + `load-error.js` | done | merged + gated 2026-11-17; 24-name API intact |
| 13 | T-123 | delete `player.js`, `player/index.js` hub | done | merged + gated 2026-11-17; M2 complete |
| 14 | T-140 | `settings/nav.js` + `select.js` | done | merged + gated 2026-11-17; settings.js 698 LOC |
| 15 | T-141 | `settings/render.js` + `playlists.js` + `render-cards.js` | done | merged + gated 2026-11-17; settings.js 56 LOC |
| 16 | T-142 | `settings/playback.js` + `settings/index.js` | done | merged + gated 2026-11-17; M4 complete |
| 17 | T-150 | `app/boot.js` splash staging | partial | merged + gated 2026-11-17; rest needs T-150b |
| 18 | T-150b | app boot/startup registry + remaining slices | proposed | needs human decision; before T-152 |
| 19 | T-151 | `app/remote.js` | ready | depends on T-150b |
| 19 | T-152 | `app/index.js` + `main.js` entry | ready | |
| 20 | T-153 | release script follows changelog move | ready | **same commit as T-152** — release path must never break |
| 21 | T-160 | design tokens | ready | |
| 22 | T-161 | split `styles.css` | ready | |
| 23 | T-162 | accessibility pass | ready | |
| 24 | T-170 | `state/` store | ready | T-170 is the reactive store, not T-160 |
| 25 | T-171 | `app/plugins.js` registry | ready | |
| 26 | T-172 | migrate features to plugins | ready | |
| 27 | T-173 | remote-action routing via plugins | ready | |
| 28 | T-180 | VOD data model + storage | ready | |
| 29 | T-181 | add media by URL / manifest | ready | the *first* T-181 (VOD), not the settings one |
| 30 | T-182 | `ui/library.js` — movies & series | ready | |
| 31 | T-183 | episode browsing + resume | ready | |
| 32 | T-184 | audio / subtitle / quality pickers | needs-tv | hardware pickers |
| 33 | T-185 | VOD playback integration | needs-tv | |
| 34 | T-186 | v4 settings schema migration | ready | was T-181; additive + idempotent, never change `en_settings` key |
| 35 | T-190 | `features/tizen-compat.js` | needs-tv | no TV here — gated code only |
| 36 | T-191 | engine fallback messaging | needs-tv | |
| 37 | T-192 | about panel: engine + platform info | ready | |
| 38 | T-200 | log ring buffer + copy diagnostics | ready | |
| 39 | T-201 | favorites feature | ready | |
| 40 | T-202 | info bar with clock | ready | |
| 41 | T-203 | GitHub issue templates | ready | |
| 42 | T-209 | enforced commit message format | done | hook exists and is machine-checked |
| 43 | T-211 | first-run onboarding null container | proposed | browser bug; agent must not pick up until prioritised |
| — | T-100…T-115, T-120, T-129, T-208, T-210 | Phase 0–1 + recovery/state | done | see `docs/TICKETS.md` status lines |

## M2 note — why the engine split is four tickets

The original T-121 was one ticket: move `initPlayer` + `destroyPlayer` to
`init.js` and `loadChannel` to `load.js`. It cannot be a pure move:

- `loadChannel` is **351 LOC**; the guard caps new files at 300.
- `initPlayer → handlePlayerError → loadChannel → initPlayer` is a
  **three-node import cycle** — forbidden by `npm run validate`.

The night-shift agent blocked it on 2026-11-16 with no code changed. The fix
is four ordered tickets:

1. **T-124** — `player/deps.js`, a registry of function slots. Slices call
   `deps.handlePlayerError` / `deps.initPlayer` instead of importing each
   other. Only the hub imports all slices, so the cycle becomes a wire-up.
2. **T-125** — move DOM-free helpers out of `loadChannel` so it fits under 300.
3. **T-126** — move `initPlayer` + `destroyPlayer` to `init.js`.
4. **T-127** — move `loadChannel` + `reloadChannel` to `load.js` (plus
   `load-error.js` in the same ticket if the catch block overflows 300).

**T-123** (delete `player.js`, create the `player/index.js` hub) follows T-127.
Do not reorder them — each one's acceptance depends on the previous.

## Known traps (read before starting)

- **Never use `/nightshift` as the scheduled task's prompt.** OpenChamber's
  scheduler sees a leading `/` and routes the run through `session.command`,
  which fails on v2.0.8 with `Missing key at ["name"]` before the agent starts.
  It failed four times here. Use the plain-text prompt in
  `docs/NIGHTSHIFT_PROMPT.md`; the slash command is for interactive use only.
- **`ui.js` is the T-130 hazard:** 21 module-level variables shared by every
  function. Slice first → each slice gets its own copy → UI silently breaks.
  Extract `ui/state.js` before any slicing, as T-129 did for `player.js`.
- **`player.js` and `settings.js` are not on `.prettierignore`** — they are
  already formatted. `styles.css` and `xtream.js` still are; formatting them
  is out of scope for a logic ticket.
- **`scripts/modularity-baseline.json`** has 7 known violations. CI fails on
  *new* ones only. When you fix one, run
  `node scripts/validate-modularity.mjs --update` in that commit.
- **The WGT name carries the last commit hash**, so it lags until you commit.
  Do not mistake that for a stale build.
- **`T-186`** is the settings migration; git history still says T-181 for it.
