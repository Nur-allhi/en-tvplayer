# REACH.md — Getting EN TV Player discovered

Goal: rank for what people actually type — "samsung tizen iptv player",
"m3u playlist player smart tv", "iptv .wgt sideload", "drm iptv tizen".

## Status

| # | Action | Status |
|---|--------|--------|
| 1 | README keywords + version-free banner | Done (dev) |
| 2 | Repo metadata: description, homepage, topics | Done via `gh` |
| 3 | Keyword-rich release titles/notes | Ongoing — every release |
| 4 | Pin repo on GitHub profile | Manual — 2 min, see below |
| 5 | Awesome-list PRs (`awesome-iptv`, Tizen lists) | Manual — one-time each |
| 6 | Enable Discussions + seed query-style Q&A | Manual — repo Settings |
| 7 | Answer where searchers ask (Reddit, Samsung/Tizen forums) | Ongoing — highest ROI |

## Details

### 2. Metadata (applied)
- Description: `Samsung Tizen IPTV player (M3U/M3U8) — plays DRM-protected ClearKey/PlayReady channels, sideload via .wgt, no server needed`
- Homepage: releases page
- Topics (18/20 max): `drm`, `drm-bypass`, `iptv`, `iptv-player`, `m3u8`,
  `samsung-tv`, `smart`, `smart-tv`, `tizen`, `tizen-app`, `tizen-os`,
  `tizen-tv`, `samsung-tizen`, `m3u`, `shaka-player`, `wgt`, `clearkey`,
  `playready`
- Re-apply any time with:
  ```bash
  gh repo edit Nur-allhi/en-tvplayer \
    --description "Samsung Tizen IPTV player (M3U/M3U8) — plays DRM-protected ClearKey/PlayReady channels, sideload via .wgt, no server needed" \
    --homepage "https://github.com/Nur-allhi/en-tvplayer/releases/latest" \
    --add-topic samsung-tizen,m3u,shaka-player,wgt,clearkey,playready
  ```

### 3. Releases
Title format: `EN TV Player vX.Y.Z — <one-line feature in plain words>`.
Keep the first paragraph of every release note keyword-dense
(Tizen, IPTV, M3U, DRM) — release pages are Google-indexed.

### 4. Pin
Profile → Customize your pins → pin `en-tvplayer`.

### 5. Awesome lists
Fork the list → add one line under the fitting section → open PR.
Candidate lists: `awesome-iptv`, any Samsung/Tizen awesome list.

### 6. Discussions
Repo → Settings → tick Discussions. Seed 2–3 posts titled like search
queries, e.g. "How to install an IPTV player on a Samsung Tizen TV?".

### 7. Forum answers
One genuinely helpful answer with a repo link on `r/IPTV`,
`r/samsung`, Samsung Community, or Tizen forums outperforms all
metadata tweaks combined. Answer first, link second.
