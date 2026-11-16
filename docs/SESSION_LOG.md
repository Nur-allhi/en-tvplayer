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

## 2026-11-16 — M1 closed: `lib/time.js` and capabilities probe — @maintainer

**Ticket:** T-113 ✅ · T-114 ✅ (new T-115 opened for the wiring)
**Branch:** `refactor/t-113-114-lib-time-capabilities` → `dev`
**Status:** ✅ **Phase 1 (M1) complete** — all five `lib/` modules landed

**What changed**
- **`lib/time.js` (37 LOC)** — `timeAgo`, `formatDate` extracted from
  `settings.js`. Both now take an optional pinned `locale`, and `timeAgo`
  takes an optional `now` reference instant so the buckets are testable
  without freezing the clock. `settings.js` keeps calling the 1-arg form, so
  behaviour is unchanged; 1067 → 980 LOC.
- **`lib/capabilities.js` (78 LOC)** — pure platform decisions:
  `parseWebApiVersion`, `meetsMinimumPlatform`, `selectEngine`,
  `engineLabel`, `missingApis`, `canObserveVideoFrames`,
  `MIN_WEB_API_VERSION` (5.0).
- **`player/src/capabilities.js` (68 LOC)** — the probe: the single place that
  reads `window`/`navigator`, with `detectCapabilities(win?)` injectable for
  tests, every global read wrapped in `try/catch`, plus a cached
  `capabilities()` and `currentEngine()`.
- **48 new tests** (12 time + 24 lib/capabilities + 10 probe). Total
  **133 → 177**.

**Why capabilities is two files, not one**
`docs/TIZEN_COMPAT.md` §4 specifies `lib/capabilities.js` for the probe, and
`docs/v4.PLAN.md` §4 follows it. That cannot pass the guard: `lib/` is
DOM-free by rule, and `scripts/validate-modularity.mjs` tests
`/\bwindow\b/`, which `typeof window !== 'undefined'` trips — the exact
pattern the spec uses. Rather than weaken the rule or exempt the file, the
probe moved beside `avplay.js` and only the pure decisions stayed in `lib/`.
This also happens to be better: the decisions are now testable with a plain
object instead of a fake global.

**Verified**
- `npm test` → **177 passed**, 10 files
- `npm run lint` → clean
- `npm run validate` → 27 files, 0 new violations, 7 baselined
- `npm run format:check` → clean (after `prettier --write` on 2 new files)
- `npm run build` → ok · 931.2 KB, under budget
- `npm run tizen` → WGT 468.5 KB
- **Bundle inspection, because `settings.js` cannot be unit-tested:** the
  built asset contains `Just now` (time.js) and `requestVideoFrameCallback`
  (capabilities), confirming both modules are actually wired in and not
  tree-shaken away. `settings.js` has the import at line 7, the two call
  sites at 593/897, and **no remaining local definitions**.

**Decisions**
- **`timeAgo`'s `now` parameter over fake timers.** Injecting the reference
  instant keeps `lib/` free of test-only time mocking and makes every bucket
  assertion exact. The 1-arg call form still works, which is why `settings.js`
  needed no edits at its call sites.
- **Capability probe split, rule kept intact.** Exempting `capabilities.js`
  from the DOM rule would have created the first hole in a guard that is
  otherwise absolute, for the sake of matching a document. The document was
  wrong; it is corrected below.
- **Wiring left out of T-114, tracked as T-115.** Its acceptance said "every
  platform decision reads from here". Making that true means rewriting
  `avplay.isAvailable()` and `player.js`'s engine selection — real behaviour
  risk against a box that cannot be tested on a TV from here. Recorded, not
  silently dropped.

**Watch out**
- **`useAvplay` in `player.js` is runtime state, not a capability.** It
  records that a *specific channel* fell back to native. `selectEngine()`
  reports what the *platform* can do. T-115 must not collapse them.
- **`detectCapabilities()` defaults `webAPIVersion` to `5.0` when there is no
  `tizen` global.** That is a desktop-friendly default, not a detected value;
  `meetsMinimumPlatform()` returns `true` for non-Tizen regardless.
- **The format gate caught my new files again** (2 of them). It fires on every
  new file — budget for `prettier --write` before the first gate run.
- `docs/TIZEN_COMPAT.md` §4 still shows the probe living in `lib/`. Corrected
  in a follow-up commit; if you read the §4 snippet first, it will not match
  the tree until then.

**Next**
- **T-115** — route `avplay.isAvailable()` and `player.js`'s engine choice
  through the probe, characterising current behaviour first.
- Then **M2 (`player.js` split)**, where **T-129 (`player/state.js`) must land
  before T-120** — the migration guide's warning about a naive slice
  duplicating the 21 shared module variables.

---

## 2026-11-16 — T-111 / T-112 test expansion closes the M1 loose ends — @maintainer

**Ticket:** T-111 ✅ · T-112 ✅
**Branch:** `chore/t-111-112-lib-tests` → `dev`
**Status:** ✅ done — M1's five modules all have colocated suites

**What changed**
- **`lib/url.test.js` (152 LOC, 34 tests)** for `withAuthQuery`, `redactUrl`
  and `extractAuthQuery`. Beyond the ≥20 bar, it pins: append-vs-merge into an
  existing query string, fragment preservation and the case where the param
  name appears only *inside* the fragment, prefix-collision avoidance
  (`__hdnea__extra` must not satisfy `__hdnea__`), regex metacharacters in a
  param name treated literally, the `data:` / `blob:` / `file:` non-network
  pass-through (BUG-013 / v3.0.4), and duplicate-token suppression in cookies.
- **`lib/drm.test.js` (102 LOC, 19 tests)** for `parseLicenseKeyValue`. All
  three `license_key` forms, hex normalisation, dash stripping from UUID-style
  keys, partial-dict recovery, and every rejection path.
- **`utils.test.js` (148 → 97 LOC)** trimmed to the network layer only, and
  extended while there: `{channels:[…]}` unwrapping, JSON with no channels
  array, malformed JSON, a body that is neither JSON nor M3U, and the HTTP
  status appearing in the error message.

**Verified**
- `npm test` → **133 passed**, 7 files (was 86)
- `npm run lint` → clean
- `npm run validate` → 21 files, 0 new violations, 7 baselined
- `npm run format:check` → clean **after** `prettier --write` on the three
  new/edited test files
- `npm run build` → ok · size under budget
- `npm run tizen` → WGT 468.5 KB, certificate `40:71:40:30:04:D9:49:25…`
- All test files ≤ 300 LOC (102 / 123 / 152)

**Decisions**
- **Kept the m3u naming as `lib/m3u.test.js` and added two new files rather
  than redistributing into one suite.** Each module owns its tests; a reader
  looking at `lib/url.js` finds `lib/url.test.js` beside it.
- **Two failing expectations were rewritten to match the code, not the
  reverse.** See "Watch out" — this is the intended use of a characterisation
  test.
- **`utils.test.js` extended, not just trimmed.** Cutting the moved
  assertions would have left the network layer thinner than before.

**Watch out**
- **The characterisation tests immediately caught two of my own wrong
  assumptions**, which is exactly why they exist:
  1. `parseLicenseKeyValue(`{nothex:KEY,KID:alsonothex}`)` returns **null**,
     not an empty `clearKeys` object — the function returns null when no valid
     pair survives. My first test asserted `.clearKeys` on a null.
  2. An **unterminated** brace block `{KID:KEY` still parses, because the
     non-JSON fallback strips a *leading* `{` and an *optional* trailing `}`.
     This looks like a latent bug but is harmless in practice (Kodi never emits
     it), so it is recorded as characterisation with a comment rather than
     "fixed" — changing it would be a behaviour change with no ticket.
- **The format ratchet bit my own new files.** `prettier --check` failed on
  the three files I had just written; the gate is real and applies to new
  code immediately. Worth expecting on every future commit.
- **`utils.test.js` is now 97 LOC but was 148.** If someone later looks for
  `withAuthQuery` tests and cannot find them there, they moved to
  `lib/url.test.js` — not deleted.

**Next**
- **T-113 / T-114** to close M1: `lib/time.js` from `settings.js`
  (`timeAgo`/`formatDate`) and a new `lib/capabilities.js`.
- M1 completion then unblocks M2 (`player.js` split), where **T-129
  (`player/state.js`) must land before T-120** — the migration guide's warning
  about duplicated module state.

---

## 2026-11-16 — formatting made enforceable, WGT gate added — @maintainer

**Ticket:** T-210 (new — tooling hygiene)
**Branch:** `chore/t-210-format-gate` → `dev`
**Status:** ✅ done

**What changed**
- **Root cause of the permanently-red `format:check`: line endings, not
  style.** The repo stored LF (`git ls-files --eol` → `i/lf`) but
  `core.autocrlf=true` checked everything out as CRLF, and Prettier defaults
  to `endOfLine: lf`. 21 of the 26 reported failures were this and nothing
  else. Added **`.gitattributes`** (`* text=auto eol=lf`, with CRLF
  preserved for `.bat`/`.cmd`/`.ps1`, binary for assets) and set
  `endOfLine: "auto"` in `.prettierrc`.
- **The other 5 failures were real, and are now a ratchet, not a reformat.**
  Measured first: formatting `settings.js` alone rewrites 997 of 1067 lines;
  all five together rewrite ~3158 lines. `AGENTS.md` §11.6 forbids exactly
  that. Added **`.prettierignore`** listing the five never-formatted files,
  with the rule that each is formatted on next touch and its line deleted
  then. `format:check` is now **green** and meaningful: 26 failures → 0.
- **CI no longer tolerates formatting failures.** Replaced the
  `continue-on-error: true` prettier step with `npm run format:check`.
- **`npm run tizen` added to the pre-merge checklist** (`AGENTS.md` §11, new
  rule 9). `build` proves the bundle compiles; `tizen` is the only gate that
  proves the installable WGT is signable and signed with the right key.

**Verified**
- `npm test` → 86 passed, 5 files
- `npm run lint` → clean
- `npm run validate` → 19 files, 0 new violations, 7 baselined
- `npm run format:check` → **all matched files clean** (was 26 failures)
- `npm run build` → ok · size gate under budget
- **`npm run tizen` → `EN-IPTV_Player_v3.2.0_ad7c7f6.wgt`, 468.5 KB**;
  extracted `signature.xml` and confirmed the signer fingerprint is
  `8F:73:83:29:…:80:90:23`, matching every file in `releases/`
- All six own commits re-validated against `scripts/check-commit-msg.mjs` —
  each passes

**Decisions**
- **Ratchet, not reformat.** ~3158 lines of pure-whitespace churn would bury
  any real change in the same commit and make a bisect impossible. The
  ignore-list is explicit, commented, and shrinking.
- **`.gitattributes` over relying on `core.autocrlf`.** Per-machine config
  is not a property of the repo; a fresh Linux clone and this Windows box
  must agree without setup.
- **`endOfLine: "auto"`** so a CRLF checkout cannot fail the check for a
  reason that has nothing to do with code style. `.gitattributes` keeps LF
  canonical either way.

**Watch out**
- **`prettier --check` was never the problem — the harness was.** Worth
  knowing before debugging it again: 21/26 failures vanished the moment line
  endings were normalised.
- **Prettier's member-chain rule, not `printWidth`, explains the remaining
  wrap.** `String(x).trim().replace(...)` is 3 chain groups and always
  breaks; `String(x).trim()` stays inline. Any line-length-based diagnosis
  of those 5 files is wrong.
- **A UTF-8 BOM breaks the commit-msg validator.** Re-testing an old commit
  message with `Out-File -Encoding utf8` adds a BOM, which the validator
  correctly rejects as a malformed header. Use
  `[System.IO.File]::WriteAllText(path, text, UTF8Encoding($false))`. This
  produced a false alarm — six passing commits reported as failing.
- **No TV testing was done.** `npm run tizen` proves packaging and signing,
  not runtime behaviour. The sideload + inspector smoke test from
  `docs/TIZEN_GUIDE.md` is still the maintainer's step, and `TizenSdb` is
  not installed on this machine (`SDB: null` in the packager output).

**Next**
- Finish T-111 and T-112 test expansion (colocated `lib/url.test.js` ≥20,
  `lib/drm.test.js` ≥15), then T-113 / T-114 to close M1.

---

## 2026-11-16 — Phase 1 opened: `lib/` extracted, `utils.js` off the baseline — @maintainer

**Ticket:** T-110 ✅ (T-111/T-112 modules moved, test expansion still open)
**Branch:** `feature/t-110-lib-m3u` → `dev`
**Status:** ✅ merged — first baselined violation retired

**What changed**
- **`player/src/lib/` created** with three DOM-free modules:
  - `m3u.js` (157) — `parseM3u`, `parseStreamHeaders`, `processStreamUrl`,
    `findNameSeparator`
  - `url.js` (73) — `extractAuthQuery`, `withAuthQuery`, `redactUrl`
  - `drm.js` (57) — `parseLicenseKeyValue`, `normalizeHex`, `isHex`
- **`utils.js` 348 → 66 LOC.** It now holds only the network layer
  (`fetchPlaylist`, `fetchPlaylistEntry`, `fetchPlaylistWithRetry`) and
  `escapeHtml`. `parseM3u` is imported from `lib/m3u.js` so the public
  surface of `utils.js` is unchanged for its three call sites.
- **Ratchet baseline 8 → 7 violations** (`--update`). `utils.js` is gone from
  it permanently; it cannot come back without failing `npm run validate`.
- **Tests 61 → 86.** New `lib/m3u.test.js` (+25) characterises the edge cases
  the old suite never asserted: `?`-before-edge-param handling, DRM
  directives being skipped rather than becoming headers, literal-`|` vs
  `%7C` precedence both ways, malformed percent-encoding not throwing,
  duplicate user-agent resolution, `tvg-chno` beating `channel-number`,
  zero/negative/NaN channel numbers, CRLF playlists, malformed `EXTHTTP`,
  and a later `KODIPROP` merging over an earlier `EXTHTTP` instead of
  replacing it.

**Verified**
- `npm test` → 86 passed, 5 files
- `npm run lint` → clean
- `npm run validate` → 19 files, 0 new violations, 7 baselined
- `npm run build` → ok; **bundle 953 493 B vs 953 499 B before the move**
  (stash-and-rebuild comparison), a 6-byte delta from module-boundary naming,
  well inside the ±2 % tolerance in §4 Phase 2
- DOM purity: `grep` for `document.`/`window.`/`localStorage`/`navigator.`
  across `lib/` returns nothing, and the validator enforces it for `lib/`
- Old-code-first discipline followed: the existing suite was repointed at
  `lib/m3u.js` and passed **before** any line was deleted from `utils.js`

**Decisions**
- **`utils.js` keeps its remaining exports and is NOT deleted.** MIGRATION.md
  §1 says `utils.js` is deleted once `lib/` is complete — that is correct, but
  the network layer (`fetchPlaylist*`) has DOM/`fetch` dependencies and no
  `lib/` home yet. It stays until T-113/T-114 finish the extraction.
- **`parseM3u` stayed reachable from `utils.js`.** Re-pointing the three call
  sites (`main.js`, `settings.js`, `ui.js`) was unnecessary: only `main.js`
  uses the playlist API, and the other two import `escapeHtml`. `utils.js`
  now re-imports `parseM3u` for `fetchPlaylist` internally, so nothing
  outside had to change.
- **Test expansion accepted as separate work.** T-110's own bar (≥30 tests
  covering the moved code) is met at 86 total / 25 new. T-111 and T-112's
  per-module bars (≥20 and ≥15 colocated tests) are **not** met and are left
  open on those tickets rather than claimed.

**Watch out**
- **T-110 could not have landed alone.** `parseM3u` depends on
  `extractAuthQuery` and `parseLicenseKeyValue`, so moving it first would put
  `lib/m3u.js` and `utils.js` in an import cycle — which `npm run validate`
  rejects. The three leaf modules had to move together. Anyone sequencing
  T-111/T-112 before T-110 in the ticket list should read this first.
- **`lib/` is scanned by the modularity guard, including test files.**
  `walk()` recurses and matches every `.js`, so `lib/*.test.js` must stay
  DOM-free too. Fine today, worth knowing before writing a lib test that
  reaches for `document`.
- **A bundle hash change is expected here.** The old hash was
  `index.4Ng0uPJB.js`; the split produces `index.DZXs08fz.js` for a 6-byte
  difference. Do not treat a hash change as a regression when a refactor
  crosses a module boundary — compare sizes, not names.
- `git stash` around a rebuild is the reliable way to get a before/after
  comparison; `npm run build` rewrites `dist/`, so build order matters.

**Next**
- **T-111** — add colocated `lib/url.test.js` (≥20 tests, including the
  `data:` license-URI regression from BUG-013) and move the `withAuthQuery` /
  `redactUrl` assertions out of `utils.test.js`.
- **T-112** — colocated `lib/drm.test.js` (≥15), covering all three
  `license_key` forms plus rejections.
- Then **T-113** (`lib/time.js` from `settings.js`) and **T-114**
  (`lib/capabilities.js`), which close out M1.

---

## 2026-11-16 — Phase 0 closed: audit clean, CI gates merges, stale plan retired — @maintainer

**Ticket:** T-100, T-106 (plus T-107 status correction, `FILE_SPLIT_PLAN` cleanup)
**Branch:** `chore/t-106-audit-fixes` → `dev`
**Status:** ✅ Phase 0 complete — Phase 1 is unblocked

**What changed**
- **T-100 — CI now actually gates `dev`.** The workflow already existed and
  was green; what was missing was the enforcement. Enabled branch protection
  on `dev` requiring both checks (`Test · Lint · Build · Modularity`,
  `WGT packaging`), with no required reviewers (solo project), and
  force-push/deletion blocked. Verified by reading the protection API back.
- **T-106 — 0 vulnerabilities.** `npm audit fix`: vite 6.3.5 → 6.4.6,
  source-map-js 1.2.1 → 1.2.2, vitest 5.0.2 → 5.1.0, eslint 10.11 → 10.15.
  All advisories were dev-server/test-runner only and none ship in the WGT.
- **`docs/FILE_SPLIT_PLAN.md` resolved.** It described the abandoned v1.3
  four-phase approach with stale LOC (claimed `ui.js` 838, actually 1464) and
  contradicted `docs/MIGRATION.md`. Replaced with a short superseded-pointer
  that maps each file to its real v4 ticket. `docs/BUGS.md` (BUG-002) and
  `docs/ROADMAP.md` item 6 now point at `MIGRATION.md` instead.
- **`docs/TICKETS.md`** — T-100, T-106 marked done with evidence; T-107
  corrected to committed (`cb9ccbe`) — it was recorded as "in progress,
  needs a commit" but had in fact already landed.
- **`AGENTS.md` — new §0 "Non-negotiables".** The five rules that have each
  already been broken once (mint-a-key, commit-to-main, no session entry,
  commit format, the four gates) are now at the top of the file instead of
  buried in §5, each tagged with what enforces it.

**Verified**
- `npm test` → 61 passed, 4 files
- `npm run lint` → clean
- `npm run validate` → 15 files, 0 new violations, 8 baselined
- `npm run build` → ok, **bundle byte-identical** to pre-upgrade
  (`index.4Ng0uPJB.js`); size gate 931.2 KB = 82.7 % of the 1126 KB budget
- `npm audit` → 0 vulnerabilities
- `gh api …/branches/dev/protection` → both contexts required, force-push
  and deletion disabled

**Decisions**
- **Branch protection only on `dev`, not `main`.** `main` receives a merge
  from `dev` that is already gated, so a second gate there adds a step
  without adding information. Revisit if `main` ever takes a direct commit.
- **`required_pull_request_reviews: null`** — deliberately no reviews, per
  `docs/BRANCHING.md` §1 (solo, no PRs). The protection is about CI, not
  about a second pair of eyes.
- **Deleted `FILE_SPLIT_PLAN.md`'s content rather than the file.** Old links
  in `BUGS.md`/`ROADMAP.md`/the session log still resolve, and the original
  is recoverable from git history — the pointer says how.
- **`npm audit fix`, not `--force`.** Nothing needed a breaking major bump;
  the whole set resolved within existing semver ranges.

**Watch out**
- **A `--dry-run` audit is not a fix.** `npm audit fix --dry-run` printed the
  same 7 vulnerabilities and still exited non-zero; only the real run cleared
  them. Do not read the dry-run output as failure.
- Vitest moved 5.0.2 → 5.1.0 and eslint 10.11 → 10.15 as a side effect of
  the audit fix. Both are minor bumps and the suite is green, but if a test
  behaves oddly later, that pair is the first thing to suspect.
- `npm warn allow-scripts` mentions `esbuild@0.25.12` on every install. That
  is npm's script-approval prompt, not a vulnerability — it does not appear
  in `npm audit`.
- Branch protection does **not** block a direct push to `dev` from a
  maintainer who bypasses checks unless `enforce_admins` is on. It is off by
  design (you are the only admin); the gate protects against accident, not
  against you.

**Next**
- **Phase 1 starts at T-110 (`lib/m3u.js`)** — `utils.js` is the smallest
  baselined violation (348 LOC) and `parse-m3u.test.js` already covers the
  four target functions, so the split has a real characterisation net.
  Order: T-110 → T-111 → T-112 → T-113 → T-114.
- Then T-129 (shared `player/state.js`) **before** T-120, per the migration
  guide's warning that a naive `player.js` slice duplicates module state.

---

## 2026-11-15 — migration guide for the v4 restructure — @maintainer

**Ticket:** T-105 (docs), plus new T-129 / T-153 / T-181
**Branch:** `dev`
**Status:** ✅ done — the plan now answers "what happens to the old files?"

**What changed**
- **`docs/MIGRATION.md`** (new) — the answer to "what happens with the
  existing long files": each large file is *sliced*, the slices keep their
  names, and a thin **re-export hub** preserves the old public API so every
  call site keeps working untouched. No logic is rewritten during the move;
  feature work happens afterwards in separate commits, where a regression is
  easy to bisect.
- **Found and documented three real risks** the plan had not covered:
  - **A — the release script breaks.** `scripts/release.mjs` reads
    `player/src/main.js` and requires the in-app "What's New" entry. M5
    empties `main.js` into `app/`, which would abort the release. New ticket
    T-153, landing in the same commit as the move.
  - **B — user settings lost.** v4 adds `movies`, `favorites`, `features`
    keys to `en_settings`. New ticket T-181: additive, idempotent migration
    with a `schemaVersion` field, unit-tested, and the `en_settings` key
    name never changed.
  - **C — module state splits badly.** `ui.js` has 21 module-level
    variables shared by every function; slice it naively and each slice
    gets its own copy and the UI silently stops working. New ticket T-129
    (player) and T-130 (ui) extract the shared state **before** the split.
- **`scripts/validate-modularity.mjs`** — closed a loophole found while
  writing the guide: a re-export hub (`export * from './x.js'`) counted as
  **0 exports**, so a hub could hide a 74-export API past the limit. The
  export rule now resolves the **public surface transitively**; pure hubs
  are exempt, but the slices they point at are not. Verified with an
  injected 40-export leaf (caught) and a pure hub (allowed).
- `docs/TICKETS.md` — T-129, T-153, T-181 added; the reactive-store
  cross-reference corrected from T-160 to T-170.
- `AGENTS.md` and `docs/v4.PLAN.md` link the migration guide.

**Verified**
- Confirmed the coupling is real and bounded: `player/index.html` references
  `/src/main.js` (the entry point stays), `scripts/release.mjs` references
  `player/src/main.js` (the one path that must move, now ticket T-153),
  `scripts/metrics.mjs` and the baseline reference paths generically.
- Confirmed **only `main.js` has top-level side effects**
  (`applyResponsiveScale()` and the `DOMContentLoaded` bootstrap) — every
  other file is side-effect free at import time, so slicing cannot change
  execution order.
- Confirmed `main.js` exports exactly one symbol (`refreshChannels`).
- The export-rule fix was tested with an injected violation and the files
  restored afterwards.

**Decisions**
- **The hub re-exports; the slices own the names.** A name is declared in
  exactly one slice and re-exported by the hub. Declaring it twice is a
  silent shadowing bug, so the guard resolves surfaces transitively.
- **`main.js` is never deleted** — it stays as the entry point, emptied to
  ~40 LOC. Every other large file is deleted in the *same commit* that
  creates its replacement, so a half-done split is never a possible state.
- **The old history is not rewritten** (that rule already applied to commit
  messages) — and the same reasoning applies to source files: the split
  moves code, it does not reformat it, so a revert is clean.

**Watch out**
- The v4 restructure is **invisible to users**. The shipped WGT is still one
  bundle with one entry point; only the source layout changes. The only
  user-visible difference in v4.0.0 is the new features.
- `npm run format:check` will start failing on the new slices until they are
  formatted — that is expected during a phase, and the pre-commit hook
  formats on commit.

**Next**
- Phase 0 remainder: enable "require status checks" on `dev` (T-100); fix the
  audit findings (T-106); resolve `docs/FILE_SPLIT_PLAN.md`.
- Phase 1: extract `lib/` modules with tests (T-110…T-114) — `lib/m3u.js`
  first, since it is the largest and the tests already exist.

---

## 2026-11-15 — commit message format, enforced by hook — @maintainer

**Ticket:** T-209 ✅
**Branch:** `dev`
**Status:** ✅ done

**What changed**
- **`scripts/check-commit-msg.mjs`** — validates the commit header format, a
  closed list of types and scopes, the ticket reference, the body, subject
  rules (lowercase start, no trailing period, no double spaces, no
  WIP/TODO/FIXME, no junk subjects), the 72-character header limit and the
  trailers (`Closes:`, `Refs:`, `BREAKING CHANGE:`).
- **`.husky/commit-msg`** — wires it in, so a non-conforming message is
  rejected at commit time rather than discovered later.
- **`docs/COMMIT_STYLE.md`** — the rules, the type/scope tables and worked
  examples, including a table of rejected messages with the reason each was
  rejected.
- `npm run lint:commits` — audits the existing history against the same
  rules.
- `scripts/release.mjs` — its own two commits now conform
  (`chore(release): publish vX.Y.Z`, `docs(stats): refresh download stats
  for vX.Y.Z`), so a release cannot trip its own hook.
- `AGENTS.md` and `docs/BRANCHING.md` updated to point at the style guide.

**Verified**
- Every rejection path tested and confirmed to fire: missing scope, unknown
  type, unknown scope, missing ticket, missing body, trailing period,
  uppercase subject, junk subject, over-long header, bad footer, `!` without
  a `BREAKING CHANGE:` footer.
- Valid messages accepted: `feat` with ticket and body, `chore` without a
  ticket, `merge` without a scope, a breaking change with its footer.
- **The hook was tested with real commits**: a bad message was rejected
  (exit 1), a good message committed cleanly (exit 0), with the `pre-commit`
  hook running alongside it.
- `npm run lint:commits` reports the real history: 191 commits checked, 171
  pre-date the convention.

**Decisions**
- **The scope list is closed.** Free-form scopes are how `misc`, `stuff` and
  `session`/`roadmap`/`readme` creep in. Every scope in the list is one
  worth grepping for, and adding one is a deliberate act.
- **The ticket reference lives in the subject**, not the body — so both
  `git log --oneline` and `git log --grep=T-123` find it. In the body it
  would only be found by the second.
- **Only behaviour-changing types require a body.** Forcing a body on every
  `docs` or `chore` commit trains people to write filler.
- **The old history is not rewritten.** Rewriting would change every SHA and
  break the release tags, for no benefit. The audit shows where the
  convention starts instead.
- The `merge` type exists so merge commits fit the format without needing a
  scope or a ticket; git's own "Merge branch…" messages are exempt.

**Watch out**
- The first commit after this lands must itself conform — the hook is live
  from this commit onward.
- `scripts/release.mjs` now depends on the hook accepting
  `chore(release): …` and `docs(stats): …`. If the scope list is edited
  later, keep those two or the release script breaks.

**Next**
- Phase 0 remainder: enable "require status checks" on `dev` (T-100); fix the
  audit findings (T-106); resolve `docs/FILE_SPLIT_PLAN.md`.
- Phase 1: extract `lib/` modules with tests (T-110…T-114).

---

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
- **One-off build crash observed:** `vite build` exited **139** (SIGSEGV)
  once, mid-transform, and then succeeded on every retry (3/3 clean runs
  afterwards). Not caused by these changes — the bundle hash was identical
  before and after. Almost certainly the esbuild binary crashing under
  memory pressure (7.7 GB box, ~4.3 GB already in use at the time). If it
  recurs, run the build again; if it becomes frequent, check free memory
  before the build.

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
