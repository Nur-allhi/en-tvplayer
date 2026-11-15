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

## 2026-11-15 — release signing key restored, packager now guards it — @maintainer

**Ticket:** T-104 ✅, T-208 ✅
**Branch:** `dev`
**Status:** ✅ done — the release path is unblocked

**What changed**
- Restored the real signing key and certificate to `tizen/`. The certificate
  is confirmed as the one that signed **every** released WGT (v3.0.2 →
  v3.2.0), all with SHA-1 fingerprint
  `8F:73:83:29:93:CC:1E:13:16:AE:89:00:E0:AA:BD:5B:50:80:90:23`.
- **Added `tizen/author-cert.sha256`** — the expected certificate fingerprint,
  committed to the repo. The key itself stays gitignored; the fingerprint is
  public and proves a build carries the same app identity as every previous
  release.
- **`tizen/package.mjs` now refuses to build on a fingerprint mismatch** and
  aborts with both fingerprints. Key generation prints a loud warning instead
  of silently minting one.
- Docs updated: `docs/v4.PLAN.md` §8 (resolved + the new guard),
  `docs/TICKETS.md` T-104 and the new T-208.

**Verified**
- `openssl x509 -in tizen/author-cert.pem -noout -fingerprint -sha256` →
  `40:71:40:30:04:D9:49:25:55:68:FF:44:B8:36:47:35:22:52:89:61:E6:0F:BE:57:3A:9B:28:5B:7D:B7:51:43`
- The certificate matches all six released WGTs byte for byte.
- `openssl rsa -check` → `RSA key ok`.
- The private key's modulus matches the certificate's modulus (it is its pair),
  and a signature made with it verifies against the certificate.
- **A WGT built with the restored key carries a byte-identical signer
  certificate to the released v3.2.0** (853 bytes, identical) — end-to-end
  proof of the whole chain.
- **Guard tested both ways:** with the correct certificate the build succeeds;
  with a freshly generated wrong certificate `npm run tizen` exits **1** and
  refuses to build. The correct key was restored afterwards and re-verified.

**Decisions**
- The certificate fingerprint is committed, the key is not. That gives the
  repo a permanent, checkable statement of "which app identity is this" with
  no secret in git.
- The guard lives in the **packager**, not only in the release script, so it
  catches the mistake at the earliest possible moment — including a manual
  `npm run tizen` build.

**Watch out**
- The private key is on this machine and is gitignored. Keep the off-machine
  encrypted backup — it is still the only copy outside this disk.
- A private key can be damaged by a copy/paste slip. The copy that arrived
  here had two transposed characters, which OpenSSL rejects with
  `n does not equal p q`. If that ever happens: the certificate is still
  good, and the key can be reconstructed from the certificate's modulus plus
  the key's own primes — but the honest fix is to re-copy from the backup.

**Next**
- Phase 0 remainder: enable "require status checks" on `dev` (T-100); fix the
  audit findings (T-106); resolve `docs/FILE_SPLIT_PLAN.md`.
- Phase 1: extract `lib/` modules with tests (T-110…T-114).

---

## 2026-11-15 — v4 groundwork committed and CI-verified — @maintainer

**Ticket:** T-100, T-101, T-102, T-103, T-105, T-107
**Branch:** `chore/v4-planning` → merged into `dev` → pushed
**Status:** ✅ merged to `dev` (`cd809e6`)

**What changed**
- Committed the v4 groundwork as four logical commits on `chore/v4-planning`,
  merged `--no-ff` into `dev`, deleted the branch, pushed to `origin/dev`.
  - `fix(tooling)` — the two Linux portability fixes (proxy SHA-1, `nul` file)
  - `chore(lint)` — extended ESLint to `proxy/` and `tizen/`; this surfaced a
    dead `renameSync` import in `tizen/package.mjs`, now removed
  - `feat(tooling)` — CI workflow + the three guard scripts + the ratchet
    baseline
  - `docs(v4)` — the document set and the rewired existing docs
- Simplified the whole workflow for a **solo maintainer**: no pull requests, no
  reviewers. Direct merges into `dev`; `main` still only receives a tested
  release. Added an `experiment/` branch type for throwaway spikes and explicit
  AI-agent collaboration rules (branch, never `main`, never mint a signing key,
  always append to this log).
- Added a self-review checklist to `docs/BRANCHING.md` §6 — with no second
  pair of eyes, it is the gate that stands between a bad merge and users.
- Fixed AGENTS.md section numbering (two sections both numbered 4, no section
  11) — now runs 1–13 cleanly — and the stale `AGENTS.md §8` reference in
  `docs/ROADMAP.md`.
- Switched the `origin` remote from HTTPS to SSH. The HTTPS push failed with
  `could not read Username`; the SSH key was already present and working.

**Verified**
- `npm test` → 61 passed · `npm run lint` → clean · `npm run validate` → 0 new
  violations · `npm run build` → 953 KB · `npm run tizen` → signed WGT
- **CI ran on the real push and passed**: every step green —
  Unit tests · Lint · Modularity guard · Build · Bundle size gate ·
  Formatting check · WGT packaging + artifact upload
- The only non-zero step is `Formatting check`, which carries
  `continue-on-error: true` on purpose for the 8 known legacy files
- Working tree clean; `dev` is 8 commits ahead of `main`, `main` is 0 ahead of
  `dev` (nothing lost)

**Decisions**
- **CI runs on `push`, not only on pull requests.** With no PRs in this
  workflow, a `pull_request`-only workflow would never have run. The
  `pull_request` trigger is kept for the community-fork case.
- **The remote moved to SSH.** HTTPS push was broken in this environment;
  SSH worked immediately with the existing key. The remote URL is a local
  config change, not a repo change — nothing in the repo depends on it.
- **The self-review checklist is mandatory, not advisory.** Item 4 of the
  Definition of Done (`docs/v4.PLAN.md` §11) now requires it, and the merge
  rule states that a branch merges into `dev` only after items 1–4 are green.

**Watch out**
- **`tizen/author-key.pem` on this machine is still NOT the release key.**
  Minted locally 2026-11-11 by a test build; the released v3.2.0 WGT used a
  key from 2026-08-28 — SHA-256
  `40:71:40:30:04:D9:49:25:55:68:FF:44:B8:36:47:35:22:52:89:61:E6:0F:BE:57:3A:9B:28:5B:7D:B7:51:43`.
  **Restore it from the off-machine backup before any release** — a different
  key makes the TV treat the update as a new app and wipe every user's
  settings. Procedure: `docs/v4.PLAN.md` §8, ticket T-104.
- `main` has not received anything yet — that is correct. The next release
  merges `dev` → `main` and then runs `npm run release` from `main`.
- Branch protection is **not** enabled on `dev`. Without reviewers, enable
  only "require status checks to pass" — CI is green and ready to gate merges.
  Ticket T-100.
- `npm run format:check` still fails on 8 legacy files (pre-existing,
  deliberate). CI tolerates it; the pre-commit hook formats them on touch.
- `npm audit`: 2 high (vite ≤6.4.3, source-map-js) + 5 moderate. Dev-server
  only. Ticket T-106.
- `docs/FILE_SPLIT_PLAN.md` still describes the old v1.3 split approach and is
  superseded by `docs/v4.PLAN.md` M1–M5 — update or delete it so two plans
  do not disagree.
- `origin/fix/segment-404-reload` is a stale remote branch from an old fix —
  safe to delete.

**Next**
- Phase 0 remainder: restore the signing key (T-104); enable "require status
  checks" on `dev` (T-100); fix the audit findings (T-106); resolve
  `docs/FILE_SPLIT_PLAN.md`.
- Phase 1: extract `lib/` modules with tests (T-110…T-114) — `lib/m3u.js`
  first, since it is the largest and the tests already exist.

---

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
