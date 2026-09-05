# Download Stats

GitHub counts every `.wgt` download per release asset — direct installs and
Apps2Samsung bundle installs share one counter, so per-source numbers are not
available. Second-hand WGT sharing is invisible.

Refresh after each release:

```bash
gh api repos/Nur-allhi/en-tvplayer/releases --jq \
  "[.[] | {tag: .tag_name, downloads: ([.assets[] | .download_count] | add)}]"
```

## Downloads by release (2026-09-05)

| Release | Downloads |
|---------|-----------|
| v1.9.0 | 0 |
| v1.8.0 | 0 |
| v1.7.0 | 8 |
| v1.5.0 | 5 |
| v1.4.0 | 7 |
| v1.3.0 | 1 |
| v1.1.0 | 12 |

## Active users

Active-user counting requires the opt-in anonymous ping
(`docs/TELEMETRY.md`). Until the ping endpoint is deployed, active usage is
unknown by design — the app phones home to nothing.
