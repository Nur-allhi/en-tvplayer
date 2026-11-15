# WORKING ON THIS REPO — EN TV Player

> **Audience:** the maintainer (solo), and any AI agent working under
> `AGENTS.md`.
> **Date:** 2026-11-15.
>
> There is no contributor queue and no pull-request review. You are the
> maintainer. The rules below exist to protect **your users** from a bad
> merge, and to keep a solo project legible after three months of silence.

---

## 1. What you need

| Tool | Version | Why | Install |
|------|---------|-----|---------|
| Node.js | ≥ 20 (22+ recommended) | build, test, lint | `nvm install 22` |
| npm | ≥ 10 | workspaces | ships with Node |
| Python 3 | ≥ 3.8 | WGT zip helper (`tizen/ziphelper.py`) | `apt install python3` |
| OpenSSL | ≥ 1.1 | WGT signing | `apt install openssl` |
| Git | any | — | — |
| Samsung TV *(optional)* | Tizen 5.0+ | playback verification | see §7 |

**You do NOT need** a Samsung TV to work on this repo. The unit suite, lint,
build and WGT packaging all run headless. A TV is only needed to *verify
playback behaviour* (§7 explains how to flag that).

---

## 2. Setup

```bash
git clone https://github.com/Nur-allhi/en-tvplayer.git
cd en-tvplayer
npm install
```

Verify the toolchain:

```bash
npm test      # expect: 61 passed
npm run lint  # expect: no output
npm run build # expect: dist/assets/index.*.js
```

Everyday commands:

```bash
npm run dev     # Vite dev server → http://localhost:5173/enplayer/
npm run proxy   # HTTPS testing relay → https://localhost:5001
npm run tizen   # build + sign the .wgt → stable/ or beta/
npm run metrics # LOC / bundle / test report
npm run validate # modularity guard
```

> **DRM on desktop needs a secure context.** Open the dev server at
> `http://localhost:5173` — a LAN IP (`http://192.168.x.x:5173`) is an
> insecure context and EME/DRM is blocked. See `docs/SECURITY.md`.

---

## 3. Repository map

```
player/src/       app source — the thing you usually edit
player/index.html  DOM skeleton (all static markup lives here)
player/public/     static assets (logo, icons)
tizen/             WGT packaging + signing (package.mjs, install.mjs)
scripts/           release automation + CI guards
proxy/             desktop testing relay
docs/              all documentation — see below
releases/          published .wgt files
```

**Read these before you change code:**

| Doc | Read it when |
|-----|--------------|
| `AGENTS.md` | Always — the agent brief and house rules |
| `docs/v4.PLAN.md` | Planning the current work |
| `docs/BRANCHING.md` | Branching, commits, versioning, releases |
| `docs/TICKETS.md` | Picking up work |
| `docs/SESSION_LOG.md` | Where the work stands · **append when you finish** |
| `docs/TIZEN_COMPAT.md` | Touching platform-specific code |
| `docs/TIZEN_GUIDE.md` | Touching UI, CSS, or remote input |
| `docs/SECURITY.md` | Touching user data or network calls |

---

## 4. House rules (non-negotiable)

1. **≤ 300 LOC per file.** Split before it grows past the limit.
2. **Write code only to spec.** Minimum, not maximum. One simple solution.
3. **No dead code.** No speculative abstractions, no unused imports.
4. **Pure logic goes in `player/src/logic.js`** (or `lib/`), DOM-free, tested.
5. **Never import DOM-coupled modules in tests.** Test extracted helpers.
6. **A bug fix gets a regression test first** — reproduce, then fix, then green.
7. **Every user-facing string is plain English.** No HTTP codes, no codec
   names, no `error 4032` in the UI.
8. **Never log a stream URL's query string.** Use `redactUrl()`.
9. **No secrets in git.** Ever.
10. **Never mint a new signing key.** See `docs/v4.PLAN.md` §8.

---

## 5. Making a change

### 5.1 Pick a ticket

```bash
git checkout dev && git pull --ff-only origin dev
git checkout -b feature/<ticket>-<slug>
```

One ticket = one branch. No drive-by changes — they hide in diffs.

### 5.2 Implement

```bash
npm test && npm run lint && npm run build && npm run validate
```

### 5.3 Commit

```
<type>(<scope>): <description>

Types:  feat | fix | refactor | docs | test | chore | style | perf
Scopes: player | ui | settings | app | lib | tizen | proxy | release | docs
```

Examples:

```
feat(ui): add favorites toggle on red key
fix(player): reset segment-404 budget on new URL
refactor(ui): extract dialogs into ui/dialogs.js
docs(v4): record measured Tizen compatibility matrix
```

One logical change per commit. Bodies explain **why**.

### 5.4 Merge to `dev`

```bash
git checkout dev
git merge --no-ff feature/<ticket>-<slug>
npm test && npm run lint && npm run build && npm run validate
git push origin dev
git branch -d feature/<ticket>-<slug>
```

Then update `docs/TICKETS.md` and append to `docs/SESSION_LOG.md`.

Full detail: `docs/BRANCHING.md` §3.

---

## 6. Testing

```bash
npm test              # full suite
npm run test -w player
npx vitest            # watch mode, from player/
npm run lint
npm run validate      # modularity guard
npm run format:check
```

**Vitest covers DOM-free logic only** (node environment, no jsdom — see
`player/vite.config.js`). TV-specific behaviour (Shaka/EME, AVPlay, remote
keys, CSS, `file://` quirks) needs a device or a TV.

**When writing tests:**

- Pure logic → `player/src/<module>.test.js`, colocated.
- Test file ≤ 300 LOC.
- One behaviour per `it()`.
- Name the test after the behaviour, not the function:
  `it('resumes playback after an unexpected pause')`, not `it('test shouldResume')`.

---

## 7. Verifying on a TV

Desktop is a **smoke test**, not a substitute. Shaka, EME, AVPlay, the remote
layer and Tizen CSS quirks only reproduce on hardware.

**If you have a TV:**

```bash
npm run build
npm run tizen
# upload the .wgt to the TV (Developer Mode must be running)
node tizen/install.mjs --ip=<TV_IP>
```

Then open the app on the TV and exercise the changed path. Use the TV's
inspector (enable it in Developer Mode) for logs.

**If you don't have a TV:** say so — mark the ticket *needs TV verification*
in `docs/TICKETS.md`. Do not claim TV-verified status you haven't earned;
that is how regressions reach users.

---

## 8. Reporting bugs (from users)

When a user reports an issue, ask for:

- App version, TV model, Tizen version
- Playlist type (M3U or Xtream) and channel name
- What happened vs what you expected
- Inspector log lines around the moment (redacted — no passwords, no full
  stream URLs with tokens)
- Whether it happens every time or only sometimes

Log it in `docs/BUGS.md`.

---

## 9. Working on the v4 plan

`docs/v4.PLAN.md` is the master plan. Phases M0–M10 are sequential for the
code-splitting work (M1–M5 touch the same files) but **M6 (design system) can
run in parallel** with M2–M5 because it touches only CSS.

Before starting a phase:

1. Read the phase's exit criteria in `docs/v4.PLAN.md`.
2. Confirm the previous phase's exit criteria are met on `dev`.
3. Create the branch, implement, verify, merge.

**Definition of Done** (per ticket) is `docs/v4.PLAN.md` §11 — all eight items
apply, including the session-log entry.

---

## 10. Working with an AI agent

The repo is set up for agent collaboration (`AGENTS.md` is the brief,
`docs/SESSION_LOG.md` is the handover). What makes it work:

- **One ticket per session.** Give the agent a ticket ID and a branch.
- **The agent appends to `docs/SESSION_LOG.md`** before it finishes.
- **The agent never touches `main`** and never mints a signing key.
- **You still verify** — run the test/lint/build/validate quartet yourself
  and read the diff. The agent's report is evidence, not proof.
- **The agent's self-review does not replace yours** — the checklist in
  `docs/BRANCHING.md` §6 is the last gate before `dev`.

---

## 11. Release access

Releases are cut from `main`:

```bash
npm run release -- 4.0.0            # stable
npm run release -- 4.0.0-beta.1 --beta
```

The script enforces the guards (clean tree, `gh` auth, signing key present,
branch rule, unused tag). **If a guard blocks you, fix the cause — do not
work around it.** The signing-key guard exists because a different key makes
the TV treat the update as a new app and wipe every user's settings.

---

## 12. Code of conduct

Not applicable to a solo project — but the habit still counts: review the
**code**, not the author of the code. Including code you wrote three months
ago and no longer remember.
