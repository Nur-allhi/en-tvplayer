# REPO RULES — EN TV Player

> **Version:** 1.1 · **Date:** 2026-08-28

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

---

## ⚠️ 8. Community Packages Update — MANDATORY

**Every release MUST update the community JSON file.**

### Rule
When you release a new version, you MUST:
1. Update `packages/Nur-allhi__en-tvplayer.json` in `tizen-community-packages` repo
2. Ensure `output_name` matches your release asset filename
3. Open a PR to `Apps2Samsung/tizen-community-packages`

### Why
- Users discover your app through the community bundle
- Old versions in the bundle = bad user experience
- Maintainers may remove apps that are rarely updated

### Checklist for Every Release

- [ ] Version updated in `package.json` and `player/package.json`
- [ ] WGT built successfully
- [ ] GitHub release created with direct .wgt file
- [ ] Community JSON file updated (if asset filename changed)
- [ ] PR opened to `Apps2Samsung/tizen-community-packages`
- [ ] PR merged successfully

### What to Update in JSON

```json
{
  "name": "EN TV Player",
  "description": "...",
  "repo": "Nur-allhi/en-tvplayer",
  "source": "release",
  "branch": "main",
  "output_name": "EN-IPTV_Player.wgt"  ← Must match release asset
}
```

### When to Update

- **Always:** On every new release
- **If changed:** Asset filename, repo name, branch
- **Never:** Remove the JSON file (app stays in community)
