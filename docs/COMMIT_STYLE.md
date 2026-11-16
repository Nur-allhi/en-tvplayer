# COMMIT STYLE — EN TV Player

> **Status:** enforced by a `commit-msg` hook. **Date:** 2026-11-15.
> **Enforcer:** `scripts/check-commit-msg.mjs` · **Hook:** `.husky/commit-msg`
>
> A commit message is the only documentation of a change that survives the
> session. Six months later, `git log` is the map of the project — but only
> if the messages were written to be read.

---

## 1. The format

```
<type>(<scope>): <subject> (T-<ticket>)

<body — why the change was needed>

<optional trailers>
```

**Worked example:**

```
fix(player): bound the segment-404 reload budget (T-120)

A live segment that fell off the edge returned 404, and the reload used a
fresh master playlist — but the budget reset on every loadChannel() call,
so the same dead link was reloaded forever and the TV eventually killed
the app.

The budget is now keyed by URL with a 5-minute window, so an incident
burst gets 3 re-syncs and a new link starts fresh.

Closes: T-120
```

---

## 2. Rules

### Header

| Rule | Detail |
|------|--------|
| Format | `<type>(<scope>): <subject>` — the type and scope are required, except for `merge` |
| Length | 72 characters or fewer, **including** the ticket reference |
| Subject case | lowercase start (it continues the type prefix) |
| No trailing period | `add favourites toggle` not `add favourites toggle.` |
| No double spaces | |
| No WIP/TODO/FIXME | finish the commit or park it on a branch |

### Subject

- **Imperative mood**: "add", not "added" or "adds".
- **Say what changed**, not how you changed it. The diff already shows how.
- **No junk subjects**: `fix`, `wip`, `update`, `changes`, `stuff`, `misc`
  are rejected — they say nothing.
- **Keep it under ~50 characters** of subject text, so `git log --oneline`
  stays readable.

### Body

**Required** for `feat`, `fix`, `refactor`, `perf`. **Optional** otherwise.

- Write **why**, not **what**. The diff shows what.
- Wrap at 100 characters.
- One blank line between the header and the body.
- Say what problem existed and why this is the fix — future you will not
  remember, and neither will the next agent.

#### Two traps that will reject your commit

Both are consequences of how `scripts/check-commit-msg.mjs` parses the
message. Neither is obvious, and both cost a rewrite the first time.

**1. A body line starting `word: ` is read as a trailer.** The parser finds
the first body line matching `^[A-Za-z-]+: ` and treats **everything from
there down** as trailers. A body sentence like

```
The gap was enforcement: nothing stopped a red check from reaching dev.
```

silently truncates the body at that line and then rejects the words after it
as unrecognised trailers. Rephrase to avoid a colon after a word at the
start of a line — use a dash, a comma, or restructure the sentence.

**2. The scope list is closed and smaller than it looks.** `v4` is **not** a
scope. Documents are full of `docs(v4): …`-style prose, but the hook rejects
it. Use `migration` for restructure planning, `roadmap` for plan documents.

Run `npm run lint:commits` to audit the whole history after a rule change.

#### Where to put a message file

`git commit -F <file>` needs the message somewhere on disk before it is
committed. **Never create that scratch file inside the repository** — a
stray `msg.txt` in the tree is one `git add -A` away from being committed,
and it adds nothing to the history that the commit itself does not already
contain.

Put it in the OS temp directory instead, so it can never be staged:

```powershell
# Windows
git commit -F "$env:TEMP\msg.txt"
```

```bash
# Linux / macOS
git commit -F /tmp/msg.txt
```

Delete it afterwards. Temporary scratch files are not documentation;
**documentation lives in `docs/` as `.md`**.

### Ticket reference

- **Required** in the subject for `feat`, `fix`, `refactor`, `perf`.
- Format: `(T-123)` — the ticket IDs live in `docs/TICKETS.md`.
- Put it in the **subject**, not the body, so `git log --oneline` and
  `git log --grep=T-123` both find it.
- Optional for `docs`, `test`, `chore`, `build`, `style`.

### Trailers

| Trailer | Use |
|---------|-----|
| `Closes: T-123` | the commit completes that ticket |
| `Refs: T-123` | the commit relates to that ticket |
| `BREAKING CHANGE: <text>` | required whenever the header carries `!` |

---

## 3. Types

| Type | Use for | Ticket? | Body? |
|------|---------|---------|-------|
| `feat` | a new user-facing capability | required | required |
| `fix` | a bug fix | required | required |
| `refactor` | restructuring, no behaviour change | required | required |
| `perf` | a performance change | required | required |
| `docs` | documentation only | optional | optional |
| `test` | tests only | optional | optional |
| `chore` | tooling, deps, config, housekeeping | optional | optional |
| `build` | build system and packaging | optional | optional |
| `style` | formatting only, no semantics | optional | optional |
| `merge` | a merge commit — no scope, no ticket | — | — |

---

## 4. Scopes

A **closed list**. Every scope is one you would want to grep for. Adding a
scope is a deliberate act, not something you do because you ran out of ideas.

| Scope | Covers |
|-------|--------|
| `player` | playback engine (`player.js`, `avplay.js`) |
| `ui` | UI layer and styles (`ui.js`, `styles.css`) |
| `settings` | the settings page |
| `remote` | remote / key handling |
| `config` | config and localStorage |
| `lib` | pure utilities and logic |
| `app` | app orchestration and boot |
| `tizen` | WGT packaging and signing |
| `proxy` | the desktop testing relay |
| `release` | release tooling and process |
| `tooling` | repo tooling: scripts, hooks, dev environment |
| `ci` | GitHub Actions |
| `docs` | documentation generally |
| `session` | the session handover log |
| `roadmap` | roadmap and plan documents |
| `readme` | README |
| `agents` | AGENTS.md |
| `stats` | download statistics |
| `repo` | repo-wide files (LICENSE, `.gitignore`) |

---

## 5. Examples

**Good:**

```
feat(ui): add favourites toggle on the red key (T-201)

The red key was documented as a favourite toggle but did nothing. Users
asked for it in three separate issues, and the T-011 ticket has been open
since v1.2.

Favourites now appear as a pinned group at the top of the channel list and
persist in settings.

Closes: T-201
```

```
fix(player): stop the stall watchdog restarting a working stream (T-130)

The watchdog treated a frozen clock as proof of a stuck stream, but on a
slow relay the segments are still flowing while the decoder waits. The
tune was restarted every 15s and never recovered.

The watchdog now checks Shaka request activity and waits while the network
is live, bounded to ~60s.

Closes: T-130
```

```
docs(v4): record the measured Tizen compatibility matrix (T-105)

Tizen 4.0 support was assumed to be a matter of polyfilling. Measuring the
shipped bundle against the platform matrix showed the real blocker is
Shaka's dependency on Proxy, which cannot be polyfilled.

Tizen 5.0 is now the documented floor, and the evidence is recorded so the
question does not get re-asked.

Closes: T-105
```

**Rejected — and why:**

| Message | Why |
|---------|-----|
| `update stuff` | no type, no scope, no ticket, no meaning |
| `fix(player): fix` | junk subject |
| `feat(ui): Add favourites` | subject starts uppercase |
| `feat(ui): add favourites toggle.` | trailing period |
| `fix: repair the proxy` | no scope |
| `feat(ui): add favourites toggle` | no ticket reference |
| `feat(ui): add favourites toggle (T-201)` with no body | no explanation of why |
| `feat(misc): add favourites toggle (T-201)` | `misc` is not a scope |

---

## 6. Working with it

```bash
# the hook runs on every commit — you do not need to invoke it
git commit -m "feat(ui): add favourites toggle (T-201)

Red key did nothing, so there was no way in.

Closes: T-201"

# check a message before committing
git commit --dry-run  # still runs the hook

# audit the existing history
npm run lint:commits
```

**Bypassing the hook** (`git commit --no-verify`) is possible but should be
rare and explained in the body. If the format is wrong for a legitimate
reason, fix the rule in `scripts/check-commit-msg.mjs` — do not route around
it forever.

---

## 7. History note

The format was adopted on 2026-11-15. Commits before that date use an
older, looser convention and mostly do not conform — `npm run lint:commits`
reports the full list. **They are not rewritten.** Rewriting history would
change every SHA and break the release tags for no benefit; the audit exists
to show where the convention starts, not to grade the past.

---

## 8. Change log

| Date | Change |
|------|--------|
| 2026-11-15 | Initial style guide, with the `commit-msg` hook that enforces it. |
