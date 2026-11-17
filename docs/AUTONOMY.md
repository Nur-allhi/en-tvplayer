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
BATCH_LIMIT = 30         # effectively unbounded — the 19:30 deadline is the real cap
NEXT        = T-185      # needs-tv code work still owed (claimed by a parallel worktree)
MODE        = unattended # agent must not ask questions; no human retry needed
LAST_RUN    = 2026-11-17 # T-191 fallback messaging by night shift (resumed batch)
```

The agent updates `NEXT`, `LAST_RUN` and the `State` column after each ticket,
then commits those doc changes with the ticket's work.

## Stop conditions — any one ends the run

1. `BATCH_LIMIT` tickets processed (set high — the clock is the real cap).
2. Clock reaches **19:30 Asia/Dhaka** — do not start another ticket.
3. Queue empty (`NEXT = none`).
4. A hard policy would have to be overridden (main, release, signing key).

**A blocked ticket is NOT a stop condition.** Record it with the gate output,
set `NEXT` to the next `ready` row, and continue. Never wait for the maintainer.
`dev` CI must be green before moving on; retry a fix up to three times, then
mark blocked and continue.

## Reporting

The `post-commit` hook appends one row to `docs/AUTONOMY_REPORT.md` after every
commit: timestamp, SHA, subject, queue done/total, ready count and `NEXT`.
That is the report the maintainer reads — no chat reply is required.

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
| 1 | T-121 | M2 engine split — umbrella | done | closed by T-124…T-127 |
| 2 | T-122 | player/events + stream | done | merged + gated |
| 3 | T-130 | ui/state.js | done | merged + gated |
| 4 | T-131 | ui/dialogs.js | done | merged + gated |
| 5 | T-132 | ui/osd.js | done | merged + gated |
| 6 | T-133 | ui/sidebar + search | done | merged + gated |
| 7 | T-134 | ui/right-menu.js | done | merged + gated |
| 8 | T-135 | ui/core.js, delete ui.js | done | merged + gated |
| 9 | T-124 | player/deps.js registry | done | cycle breaker |
| 10 | T-125 | pure load helpers | done | merged + gated |
| 11 | T-126 | player/init.js | done | merged + gated |
| 12 | T-127 | player/load.js + load-error.js | done | merged + gated |
| 13 | T-123 | delete player.js, index hub | done | M2 complete |
| 14 | T-140 | settings/nav + select | done | merged + gated |
| 15 | T-141 | settings/render + cards | done | merged + gated |
| 16 | T-142 | settings/playback + index | done | M4 complete |
| 17 | T-150 | app/boot.js splash slice | partial | rest is T-152a…c |
| 18 | T-152a | app/deps.js registry | done | merged + gated |
| 19 | T-152b | onboarding + What's New | done | merged + gated + browser-smoked |
| 20 | T-152c | startup slice | done | merged + gated + browser-smoked |
| 21 | T-151 | app/remote.js | done | merged + gated + browser-smoked |
| 22 | T-152 | app/index.js, thin main.js | done | merged + gated + browser-smoked |
| 23 | T-153 | release script follows changelog | done | same commit as T-152; static-verified |
| 24 | T-160 | design tokens | done | merged + gated |
| 25 | T-161 | split styles.css | done | merged + gated |
| 26 | T-162 | accessibility pass | done | merged + gated + a11y audit |
| 27 | T-170 | state/ reactive store | done | merged + gated |
| 28 | T-171 | app/plugins.js registry | done | merged + gated; guards + contracts |
| 29 | T-172 | migrate features to plugins | done | merged + gated; both approaches reconciled |
| 30 | T-173 | remote-action routing | done | merged + gated; bindRoute + dispatchRoute |
| 31 | T-180 | VOD data model + storage | done | merged + gated; taken early to avoid a concurrent-run collision |
| 32 | T-181 | add media by URL | done | merged + gated; first T-181 |
| 33 | T-182 | ui/library.js | done | merged + gated; pure nav stack |
| 34 | T-183 | episode browsing | needs-tv | merged + gated; restore needs T-185 + TV |
| 35 | T-184 | audio/subtitle/quality pickers | needs-tv | merged + gated; caption check owed |
| 36 | T-185 | VOD playback integration | ready | was mis-labelled needs-tv |
| 37 | T-186 | settings schema migration | done | merged + gated; was T-181 |
| 38 | T-190 | features/tizen-compat.js | needs-tv | shims merged + gated; TV boot owed |
| 39 | T-191 | engine fallback messaging | needs-tv | notice merged + gated; TV boot owed |
| 38 | T-190 | features/tizen-compat.js | ready | was mis-labelled needs-tv |
| 39 | T-191 | engine fallback messaging | needs-tv |  |
| 40 | T-192 | about panel | done | merged + gated; taken early to avoid a concurrent-run collision |
| 41 | T-200 | log ring buffer | done | merged + gated; taken early to avoid a concurrent-run collision |
| 42 | T-201 | favorites feature | done | merged + gated; taken early to avoid a concurrent-run collision |
| 43 | T-202 | info bar with clock | done | merged + gated; taken out of order |
| 44 | T-203 | GitHub issue templates | done | merged + gated; taken early to avoid a concurrent-run collision |
| 45 | T-209 | enforced commit format | done | hook exists |
| 46 | T-211 | first-run onboarding crash | proposed | agent skips |

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
