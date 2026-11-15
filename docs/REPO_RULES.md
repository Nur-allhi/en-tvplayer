# REPO RULES — EN TV Player

> **Status:** superseded. **Date:** 2026-11-15.
>
> This file used to hold the branching, commit and release rules. They now
> live in one authoritative place so two copies can never drift apart:
>
> | Topic | Authoritative doc |
> |-------|-------------------|
> | Branches, commits, versioning, releases | **`docs/BRANCHING.md`** |
> | Tickets and backlog | **`docs/TICKETS.md`** |
> | Master plan and quality gates | **`docs/v4.PLAN.md`** |
> | House rules for agents | **`AGENTS.md`** |
> | How to contribute from any machine | **`docs/CONTRIBUTING.md`** |
> | Session handover | **`docs/SESSION_LOG.md`** |
>
> Keep this file as a pointer only. Do not restate rules here — a second copy
> is a second thing to keep in sync, and that is how contributors end up
> following the wrong one.

---

## The short version

If you read nothing else:

1. Branch from `dev`, one ticket per branch: `feature/<ticket>-<slug>`.
2. One logical change per commit, conventional-commit format.
3. `npm test`, `npm run lint`, `npm run build`, `npm run validate` all pass
   before you push.
4. Merge the branch into `dev`, push, delete the branch.
5. Update `docs/TICKETS.md` and append to `docs/SESSION_LOG.md`.
6. `main` only ever receives a release. Never commit to it directly.

There are no pull requests — this is a solo project. The checklist in
`docs/BRANCHING.md` §6 is your only review, so run it honestly.

Full detail: `docs/BRANCHING.md`.

---

## Community packages

The community bundle (`Apps2Samsung/tizen-community-packages`) auto-detects
stable releases — the bundle matches `EN-IPTV_Player_v.*[.]wgt$` on the
latest release. **No per-release JSON edit and no PR are needed** as long as
the asset filename keeps that shape.

Earlier versions of this document required a PR per release. That is no
longer accurate: the bundle detects the asset automatically. Update the JSON
only if the asset filename, repo name, or branch changes.

See `docs/BRANCHING.md` §7.
