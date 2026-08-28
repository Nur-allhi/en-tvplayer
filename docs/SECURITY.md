# SECURITY — EN TV Player

> **Version:** 1.0 · **Date:** 2026-08-28
> **Posture:** standalone TV app, local network only.

---

## 1. Trust Boundaries

```
[User] ── remote ── [TV App] ── fetch ── [Playlist URLs/CDNs]
                      │
                      └── localStorage (settings, channels)
```

- **Trusted:** The user and their TV
- **Untrusted:** Playlist URLs, CDN streams, M3U content

---

## 2. Data Storage

| Data | Storage | Notes |
|------|---------|-------|
| Settings | localStorage | Device-local only |
| Channels | localStorage | Cached from playlist |
| Proxy overrides | localStorage | Per-channel toggle |
| DRM keys | localStorage | User's own data |

**No data leaves the device. No telemetry. No cloud.**

---

## 3. Secrets Policy

- **No secrets in git — ever.**
- Self-signed certs (`tizen/*.pem`) are git-ignored
- WGT files in `releases/` are safe (no secrets)

---

## 4. Input Validation

- All playlist-derived strings pass `escapeHtml()` before innerHTML
- URLs validated before fetching
- No user input reaches eval() or similar

---

## 5. Review Checklist

- [ ] No unescaped untrusted string reaches innerHTML
- [ ] No secret/credential added to repo
- [ ] File ≤ 300 LOC
- [ ] No dead code
