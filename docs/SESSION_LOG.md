# SESSION LOG — EN TV Player

> **Purpose:** a handover record. Anyone picking up the repo reads the last
> entry here to learn where the work stands without reading the whole history.
> **Rule:** every working session appends one entry before it ends. A session
> that ends without an entry is treated as unfinished.
> **Append only.** Never edit or delete an earlier entry — it is the audit
> trail of how the project got here.

---

## How to write an entry

Copy the template, fill it in, append it **at the top** of the log (newest
first). Keep it short — the point is handover, not a diary.

```markdown
## YYYY-MM-DD — <what you worked on> — @<name>

**Ticket:** T-1xx
**Branch:** feature/xxx → dev
**Status:** ✅ merged · 🔄 in progress · ⛔ blocked

**What changed**
- …
- …

**Verified**
- `npm test` → N passed
- `npm run build` → ok
- Manual: <what you clicked / what you saw>

**Decisions**
- <why you chose X over Y>

**Watch out**
- <anything that will bite the next person>

**Next**
- <the obvious next step>
```

---

## Log

## 2026-11-15 — v4 plan, environment setup, CI + modularity guard — @maintainer

**Ticket:** T-105 (docs), T-107 (toolchain fixes), T-100/T-101/T-102/T-103
**Branch:** `main` → working tree
**Status:** 🔄 in progress — everything below is uncommitted

**What changed**

*Documentation set (new)*
- `docs/v4.PLAN.md` — master plan: goals + measurable criteria, measured
  baseline, target architecture, 11 phases (M0–M10) with entry/exit criteria,
  dependency order, CI gates, 11-item risk register, release cadence, DoD.
- `docs/TIZEN_COMPAT.md` — measured platform matrix (§5 has the re-verify
  commands).
- `docs/BRANCHING.md` — branch model, versioning, release flow, migrations,
  self-review checklist.
- `docs/SESSION_LOG.md` — this file.
- `docs/CONTRIBUTING.md` — setup, workflow, testing, TV verification.

*Documentation set (rewritten)*
- `docs/TICKETS.md` — v4 backlog (T-100…T-203) with spec + acceptance
  criteria per ticket; v1–v3 history preserved.
- `docs/ROADMAP.md` — points at the v4 plan; Tizen 4 recorded as ruled out.
- `docs/REPO_RULES.md` — reduced to a pointer (it contradicted BRANCHING.md on
  the community-bundle PR).
- `AGENTS.md` — doc index, branch policy, remote keys, Tizen floor, DoD,
  modularity guard, session-log rule.
- `README.md` — CI badge; limitations now state the Tizen 5.0 floor.
- `CHANGELOG.md` — `## [Unreleased]` section added (the release script aborts
  without it).

*Tooling (new)*
- `scripts/validate-modularity.mjs` — enforces LOC ≤ 300, exports ≤ 15, no
  circular imports, DOM purity in `logic.js`/`lib/`, no `console.log`.
  Uses a **ratchet**: `scripts/modularity-baseline.json` records the 8 known
  v3.2.0 violations; CI fails only on *new* ones. `--strict` / `--update`.
- `scripts/metrics.mjs` — LOC table, over-limit list, bundle size, test count.
- `scripts/check-bundle-size.mjs` — 1.1 MB budget gate.
- `.github/workflows/ci.yml` — test → lint → validate → build → size gate →
  WGT packaging + artifact upload.

*Tooling (fixed)*
- `proxy/proxy.mjs` — `selfsigned` defaults to SHA-1; OpenSSL 4 rejects it
  (`invalid digest`) and the relay crashed at startup. Now `sha256`.
- `tizen/package.mjs` — `2>nul` is a Windows redirect; on Linux it created a
  file literally named `nul`. Now platform-aware.

**Verified**
- `npm test` → 61 passed (4 files)
- `npm run lint` → clean
- `npm run validate` → 0 new violations (8 tracked in the baseline)
- `npm run build` → 953.50 KB, 3.7 s; `npm run metrics` → 931.2 KB on disk
- `node scripts/check-bundle-size.mjs` → 82.7 % of budget, under
- `npm run tizen` → signed WGT, 469 KB; contents verified (8 entries,
  `signature.xml` last, `icon.png` 512×423)
- `npm run proxy` → starts, cert generated, banner shown
- **Guard tested against real violations:** injected a `console.log` (caught),
  injected a circular import (caught, cycle path printed), injected a new
  export (caught) — then restored the files
- CI YAML parsed with PyYAML → 2 jobs
- New scripts pass `prettier --check`

**Decisions**
- **Tizen 4.0 is ruled out — Tizen 5.0 is the floor.** Measured, not guessed:
  the bundle parses at `ecmaVersion 2015` (0 native `await`, 0 classes, 0 real
  optional chaining — the `?.` strings in the bundle are ternary `? .1`), so
  syntax is *not* the blocker. The blocker is Shaka Player 5.x's dependency on
  `Proxy` (Chromium 49) against Tizen 4's Chromium 47; `Proxy` cannot be
  meaningfully polyfilled. The alternative — native AVPlay only — would drop
  ClearKey/PlayReady, the app's headline feature. Evidence + re-measure
  commands: `docs/TIZEN_COMPAT.md`.
- **Corrected an earlier assumption:** "Tizen 4 has no ES modules" was wrong.
  The build emits one IIFE and the Vite plugin strips `type="module"`, so
  there is no runtime ES-module dependency at all.
- **The plugin registry must use `import()` with `inlineDynamicImports: true`.**
  Verified: Rollup *rejects* dynamic import under `format: 'iife'`
  ("UMD and IIFE output formats are not supported for code-splitting builds").
  With `inlineDynamicImports: true` the build succeeds and no `import()` is
  left in the output. A future switch to `format: 'es'` makes real lazy chunks
  free.
- **The modularity guard ships as a ratchet, not a hard gate.** A hard gate
  would fail every build on day one (8 pre-existing violations) and get
  disabled within a week. The ratchet blocks regressions and shrinks as the
  phases land.
- **VOD scope is direct URLs + user-controlled JSON/M3U manifests, not a
  shipped scraper.** Archive.org and similar pages are not CORS-readable from
  the TV, and page scrapers break whenever the site changes. The native AVPlay
  path ignores CORS, so direct URLs that the browser stack refuses can still
  play.
- **`docs/REPO_RULES.md` was reduced to a pointer** rather than kept in sync —
  it directly contradicted `BRANCHING.md` on the community-bundle PR, and two
  copies of a rule is exactly how contributors follow the wrong one.
- **Workflow simplified for a solo maintainer (later in the same day).** The
  first draft assumed contributors and pull requests. Rewritten: no PRs, no
  reviewers, direct merges into `dev`. What was **kept** is the part that
  protects users — `main` stays releasable, `dev` stays green, the
  self-review checklist, and CI as the one gate that runs when you forget to
  check. Added `experiment/` for throwaway spikes and explicit AI-agent
  collaboration rules.

**Watch out**
- **All of the above is uncommitted on `main`.** The release script requires a
  clean tree, so this must be committed before any release.
- **`tizen/author-key.pem` on this machine is NOT the release key.** It was
  minted locally on 2026-11-11 by a test build. The released v3.2.0 WGT was
  signed with a key created 2026-08-28 — SHA-256
  `40:71:40:30:04:D9:49:25:55:68:FF:44:B8:36:47:35:22:52:89:61:E6:0F:BE:57:3A:9B:28:5B:7D:B7:51:43`.
  **Restore the real key from the off-machine backup before shipping
  anything** — a different key makes the TV treat the update as a new app and
  wipe every user's settings. Procedure: `docs/v4.PLAN.md` §8, ticket T-104.
- `npm run format:check` still fails on 8 legacy files (`avplay.js`,
  `remote.js`, `settings.js`, `styles.css`, `utils.js`, `xtream.js`, 2 test
  files). Pre-existing and deliberate — legacy files are formatted on touch,
  never in a big-bang reformat. CI runs the prettier check with
  `continue-on-error` for the same reason.
- `npm audit`: 2 high (vite ≤6.4.3, source-map-js) + 5 moderate. Dev-server
  only — not shipped to TVs. Ticket T-106.
- `docs/FILE_SPLIT_PLAN.md` still describes the old v1.3 split approach. It is
  superseded by `docs/v4.PLAN.md` M1–M5 — update or delete it to avoid two
  plans disagreeing.
- `origin/dev` is 1 commit ahead of `origin/main` (a README honesty merge).
- Branch protection is **not** enabled on `main`/`dev`. Without a second
  reviewer, enable only "require status checks to pass" (no required
  reviews) — that makes CI a real gate on merges to `dev`. Ticket T-100.

**Next**
- Commit everything on `chore/v4-planning`, merge into `dev`.
- Phase 0 remainder: enable "require status checks" on `dev`; fix the audit
  findings (T-106); restore the signing key (T-104); update or delete
  `docs/FILE_SPLIT_PLAN.md`.
- Phase 1: extract `lib/` modules with tests (T-110…T-114).

---

## Older history

Pre-v4 work is recorded in the git history (`git log --oneline`) and in
`CHANGELOG.md` (user-facing) and `docs/BUGS.md` (defect history). This log
starts at the v4 planning session, 2026-11-15.
