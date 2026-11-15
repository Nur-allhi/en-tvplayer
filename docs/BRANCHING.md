# BRANCHING & VERSIONING — EN TV Player

> **Status:** authoritative. **Date:** 2026-11-15.
> **Audience:** a single maintainer, working solo — often with an AI agent.
> **Rule:** `main` is always releasable. `dev` is always working. Nothing
> lands on `main` except a tested release.

---

## 1. Branch model

Solo workflow — no pull requests, no reviewer. The branches exist to protect
you from yourself: a broken experiment must never be able to reach `main`.

```
        ┌──────────────────────────────────────┐
        │            main (protected)          │
        │   released · always releasable       │
        └───────────────▲──────────────────────┘
                        │  merge (only when green)
        ┌───────────────┴──────────────────────┐
        │            dev (protected)           │
        │   integration · always working        │
        └───────────────▲──────────────────────┘
                        │  merge when done
   ┌────────────┬───────┴────────┬─────────────────┐
   │            │                │                 │
feature/vod  fix/stale-token  chore/v4-planning  experiment/xyz
```

### 1.1 Branch roles

| Branch | Purpose | Rule |
|--------|---------|------|
| `main` | Released code. The source of every tag. | Only receives merges from `dev` after a green build. **Never commit here directly.** |
| `dev` | Integration branch. Everything lands here first. | Always builds and passes tests. |
| `feature/<ticket>-<slug>` | One ticket's work in progress. | Merge into `dev` when done, then delete. |
| `fix/<ticket>-<slug>` | One bug fix. | Same. |
| `chore/<slug>` | Tooling, CI, docs, deps. | Same. |
| `experiment/<slug>` | Throwaway spikes. **Never merged.** | Delete when the spike is done or abandoned. |

### 1.2 The five rules

1. **`main` never receives a direct commit.** Only a merge from `dev` — and
   only when the build and tests are green.
2. **`dev` is always green.** If it is broken, fix it before starting
   anything new.
3. **One ticket = one branch.** Big or small. It makes "abandon this" a
   one-line operation (`git branch -D`) instead of a revert marathon.
4. **Merge to `dev` when the ticket is done** — not when you feel like it.
5. **Delete the branch after merging.** A stale branch is a stale idea.

### 1.3 When to skip the branch

Direct commits to `dev` are fine for:
- Typo fixes, doc edits, comment changes
- Single-line config tweaks
- Anything you can revert with one `git revert`

If in doubt, use a branch. The cost is one command.

---

## 2. Versioning scheme

Semantic versioning, plus pre-release identifiers.

```
v4.0.0            stable release
v4.0.0-alpha.1    alpha build (feature branch, testers only)
v4.0.0-beta.1     beta build (release candidate)
v4.1.0            next stable
```

### 2.1 When to bump what

| Change | Bump | Example |
|--------|------|---------|
| Breaking change to behaviour, data format, or public API | **MAJOR** | v3 → v4: storage schema change, module restructure |
| New feature, backward compatible | **MINOR** | v4.0 → v4.1: Favorites feature |
| Bug fix, no API change | **PATCH** | v4.0.1: stale-token recovery fix |
| Internal refactor, no user-visible change | **none** | extract `ui/dialogs.js` |

**v4.0.0 is a MAJOR bump** because it changes the stored settings schema
(`movies`, `favorites`, `features` keys) and the module layout. Old installs
must migrate cleanly — see §5.

### 2.2 The four version files

| File | Stable release | Beta release | Purpose |
|------|---------------|--------------|---------|
| `package.json` | bumped | bumped | workspace root |
| `player/package.json` | bumped | bumped | app version → baked into the build |
| `version.json` | bumped | **NOT bumped** | in-app update checker target |
| `player/src/main.js` (CHANGELOG array) | new entry | new entry | in-app "What's New" |
| `README.md` badge | bumped | not bumped | landing page |

> **`version.json` stays pinned to the latest *stable* during betas.**
> Otherwise every stable user gets an "update available" prompt pointing at a
> test build. `scripts/release.mjs` enforces this.

---

## 3. Working loop

### 3.1 Start a ticket

```bash
git checkout dev
git pull --ff-only origin dev
git checkout -b feature/<ticket>-<slug>
```

Branch naming: `feature/<ticket>-<short-slug>`, e.g. `feature/t-180-vod-library`.

### 3.2 Work on it

```bash
# edit files…
npm test              # must pass
npm run lint          # must pass
npm run build         # must pass
npm run validate      # must pass (modularity guard)

git add -A
git commit -m "feat(ui): add favourites toggle on the red key (T-201)

The red key was documented as a favourite toggle but did nothing.

Closes: T-201"
```

Two hooks run on every commit:

| Hook | Checks |
|------|--------|
| `pre-commit` | ESLint + Prettier on staged files — blocks on errors |
| `commit-msg` | the commit message format (`docs/COMMIT_STYLE.md`) — blocks on a bad message |

The message format is **enforced**, not advisory. `npm run lint:commits`
audits the existing history against the same rules.

### 3.3 Merge to `dev`

```bash
git checkout dev
git merge --no-ff feature/<ticket>-<slug>
npm test && npm run lint && npm run build && npm run validate
git push origin dev
git branch -d feature/<ticket>-<slug>
```

Then, in the same sitting:
1. Update `docs/TICKETS.md` — move the ticket to *Done* with the merge SHA.
2. Append to `docs/SESSION_LOG.md`.

> **The session-log entry is not optional.** You are the only maintainer, and
> you will lose the thread — especially when an AI agent does the work between
> your sessions. The log is how you (or the next agent) pick up exactly where
> the last one stopped, including what was decided and what to watch out for.

### 3.4 Working with an AI agent

The repo is set up for this (`AGENTS.md` is the agent brief, `docs/SESSION_LOG.md`
is the handover file). Rules that make it work:

- **One ticket per agent session.** Give the agent a ticket ID; it works on
  one branch.
- **The agent must append to `docs/SESSION_LOG.md`** before it finishes —
  that is what tells the next session what happened.
- **The agent must not touch `main`.** It commits to a feature branch.
- **The agent must not mint a signing key** — `docs/v4.PLAN.md` §8.
- **You still verify.** Run `npm test && npm run build` yourself before
  merging. The agent's own report is evidence, not proof.

---

## 4. Release flow

### 4.1 Preparing a release

```bash
git checkout dev
git pull --ff-only origin dev
git checkout -b release/4.0.0
```

On `release/<version>`:

1. Write the release notes in `CHANGELOG.md` under `## [Unreleased]`.
2. Add the in-app entry to `player/src/main.js` — the `CHANGELOG` array must
   contain `version: '<base>'` (e.g. `'4.0.0'`), or the script aborts.
3. Update `README.md` if the feature list changed.
4. Refresh `docs/ROADMAP.md` statuses.
5. Commit and merge into `dev`.

### 4.2 Cutting the release

```bash
# stable — must be run from main
git checkout main
git pull --ff-only origin main
npm run release -- 4.0.0            # add --yes to skip confirmations
```

The script (`scripts/release.mjs`) does, in order:

1. **Guards** — clean tree · `gh` authenticated · `tizen/author-key.pem`
   present · branch rule (stable ⇒ `main`, beta ⇒ not `main`) · tag unused.
2. **Version bumps** — `package.json`, `player/package.json`; for stable also
   `version.json`, `README.md` badge, and dates the changelog.
3. **Verify + build** — `npm test`, `npm run lint`, `npm run build`, `npm run tizen`.
4. **Package** — copies the WGT to `releases/EN-IPTV_Player_vX.Y.Z.wgt`
   (+ refreshes the unversioned `releases/EN-IPTV_Player.wgt`). Beta assets go
   to `beta/` and are never committed.
5. **Publish** — commits, annotated tag, pushes (asks first unless `--yes`),
   creates the `gh release` with the changelog as notes.
6. **Stats** — stable only: refreshes `docs/STATS.md` in a follow-up commit.

### 4.3 After the release

```bash
# merge main back into dev so dev has the version bumps
git checkout dev
git merge --no-ff origin/main
git push origin dev
git branch -d release/4.0.0
```

Then update the community package (see §7).

### 4.4 Beta releases

```bash
git checkout feature/some-v4-work    # any non-main branch
npm run release -- 4.0.0-beta.1 --beta
```

Beta rules:

- `version.json` stays pinned to the last stable — stable users are never
  prompted to a beta.
- The asset is named `EN-IPTV_Player-testbuild-X.Y.Z-beta.N.wgt`, which does
  **not** match the community-bundle pattern `EN-IPTV_Player_v.*[.]wgt$` —
  so betas are invisible to the community bundle by design.
- Beta WGTs are never committed to git.

---

## 5. Data-schema migrations

v4.0.0 changes the `localStorage` schema. Migrations live in
`player/src/config.js` and run on every `getSettings()`.

**Rules:**

1. **Never delete user data during a migration.** Add defaults, keep old keys.
2. **Migration must be idempotent** — running it twice changes nothing.
3. **A migration must have a unit test** in `config.test.js`.
4. **Test the exact upgrade path:** write v3-shaped settings into
   `localStorage`, load the app, assert the v4 shape.

```js
// v3 → v4 example
if (!s.schemaVersion || s.schemaVersion < 4) {
  s.movies = s.movies || [];
  s.favorites = s.favorites || [];
  s.features = s.features || { favorites: true, infoBar: true, vod: true };
  s.schemaVersion = 4;
  dirty = true;
}
```

**Never** change the `en_settings` key name — that would orphan every
existing install.

---

## 6. Self-review checklist

Nobody else reviews your code, so this checklist is the safety net. Run it
before merging a branch into `dev` — and be honest, because it is the only
thing standing between a bad merge and your users.

**Correctness**
- [ ] Ticket acceptance criteria met
- [ ] No unrelated changes in the diff (`git diff dev...HEAD --stat`)
- [ ] Public API of touched modules unchanged unless the ticket says so
- [ ] Re-export hubs still export every previous name

**Quality**
- [ ] `npm test` · `npm run lint` · `npm run build` · `npm run validate` green
- [ ] Files ≤ 300 LOC, ≤ 15 exports
- [ ] No dead code, no commented-out blocks, no `console.log` debris
- [ ] New pure logic tested; bug fixes have a regression test

**User impact**
- [ ] `CHANGELOG.md` `[Unreleased]` updated if user-visible
- [ ] `docs/TICKETS.md` updated
- [ ] `docs/SESSION_LOG.md` entry added
- [ ] Remote-only flow verified (unplug the mouse)

**Safety**
- [ ] No secrets, credentials, or playlist URLs committed
- [ ] No signing key, cert, or `.wgt` committed
- [ ] Streaming URLs still redacted in logs

**If an agent did the work**
- [ ] You read the diff yourself — do not merge on the agent's summary alone
- [ ] The agent's session-log entry matches what the code actually does

---

## 7. Community bundle sync

`packages/Nur-allhi__en-tvplayer.json` in the
`Apps2Samsung/tizen-community-packages` repo auto-detects stable releases —
the bundle matches `EN-IPTV_Player_v.*[.]wgt$` on the latest release. **No PR
is needed** as long as the asset name keeps that shape.

Update the JSON only if the asset filename, repo name, or branch changes.

---

## 8. Change log

| Date | Change |
|------|--------|
| 2026-11-15 | Initial policy. Established `main`/`dev`/feature-branch model, four-version-file scheme, data-migration rules, review checklist. |
| 2026-11-15 | Simplified for a solo maintainer: removed PR/squash/reviewer ceremony, replaced with direct merges to `dev`. Added the `experiment/` branch type and the AI-agent collaboration rules. Review checklist reframed as a self-review checklist. |
