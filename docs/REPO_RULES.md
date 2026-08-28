# REPO RULES — EN TV Player

> **Version:** 1.0 · **Date:** 2026-08-28

---

## 1. Branch Strategy

| Branch | Purpose | Rules |
|---|---|---|
| `main` | Always deployable | No direct commits. Only merges from feature/fix branches. |
| `feature/<name>` | New functionality | e.g. `feature/favorites` |
| `fix/<name>` | Bug fixes | e.g. `fix/remote-keys` |

---

## 2. Commits (Conventional Commits)

- Format: `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`
- Example: `feat(player): preserve playlist channel numbers`
- One logical change per commit. Bodies explain *why*.
- **File limit:** no file over 300 LOC.

---

## 3. Merge Rules

1. Feature/fix branches → PR into `main`
2. Squash-merge; delete branch after merge
3. Every merge carries a one-line summary
4. README + CHANGELOG must be updated in the same PR

---

## 4. README.md

- Reflects current setup in the same PR as any change
- Stale README = PR not done

---

## 5. CHANGELOG.md

- "Keep a Changelog" format
- Updated on every merge to `main`

---

## 6. Versioning

- Semver tags: `vX.Y.Z`
- Current: `v1.1.0`
- WGT releases attach to GitHub Release — **never committed to repo**

---

## 7. Housekeeping

- `.gitignore` covers: `node_modules/`, `*.pem`, `*.p12`, `*.wgt` (except `releases/`), `logs/`
- No secrets in git ever
- `main` must build on fresh clone
