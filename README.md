# EN TV Player

**Samsung Tizen TV IPTV Player** — Install on any Tizen 5.0+ TV.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tizen](https://img.shields.io/badge/Tizen-5.0+-red?logo=samsung)]()
[![Version](https://img.shields.io/badge/version-1.1.0-blue)]()

---

## Quick Install

### Option 1: Apps2Samsung Windows App (Recommended)

1. Download [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung/releases)
2. Install and open Apps2Samsung on your PC
3. Enable Developer Mode on your TV (see below)
4. Enter your TV's IP in Apps2Samsung
5. Download `EN-IPTV_Player.wgt` from [Releases](https://github.com/Nur-allhi/en-tvplayer/releases/tag/v1.1.0)
6. Click "Install" in Apps2Samsung

### Option 2: Tizen Studio CLI

1. Download `EN-IPTV_Player.wgt` from [Releases](https://github.com/Nur-allhi/en-tvplayer/releases/tag/v1.1.0)
2. Install via command line:
   ```bash
   tizen install -n EN-IPTV_Player.wgt -s <TV_IP_ADDRESS>
   ```

---

## Features

- **No server required** — Works standalone, fetches M3U8 playlists directly
- **Full remote control** — Back key, color keys, number pad, all 14 Samsung remote actions
- **HLS / DASH / MSS** — All streaming formats via Shaka Player
- **DRM support** — ClearKey, PlayReady (including DRM license from MPD URL)
- **Per-channel proxy toggle** — Enable/disable CORS proxy per channel in app settings
- **Virtualized channel list** — Handles 5,000+ channels smoothly
- **Settings page** — Playlist management, proxy config, about info
- **Local only** — No cloud, no telemetry

---

## Samsung TV Setup

### Enable Developer Mode

1. Go to `Menu` → `Apps` → press `1-2-3-4-5` on your remote
2. Enable "Developer Mode" and enter your PC's IP address
3. Restart the TV

### Start the App

1. Open from "My Apps" on your TV
2. Settings page opens automatically when no channels are loaded
3. Paste your M3U8 playlist URL
4. Click "Fetch Playlist"
5. Start watching!

---

## Proxy Setup (Optional)

If some channels don't load (CORS issues), you can enable a proxy:

1. Open Settings (🔵 Blue key)
2. Go to Connection tab
3. Enter your proxy URL
4. For per-channel proxy: Select channel → toggle Proxy ON

---

## Remote Control Keys

| Key | Action |
|-----|--------|
| ↑ / ↓ | Previous / Next channel |
| ← / → | Navigate menus |
| Enter | Select / Play |
| Back | Close menu / Exit |
| 0–9 | Tune to channel number |
| Channel ↑/↓ | Next / Previous channel |
| Play/Pause | Toggle playback |
| Stop | Stop playback |
| 🔴 Red | Favorite toggle |
| 🟢 Green | Groups sidebar |
| 🟡 Yellow | Proxy toggle |
| 🔵 Blue | Open settings |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Stream not loading" | Press 🔵 Blue → enable Proxy for that channel |
| Channel list empty | Paste your M3U8 URL in Settings |
| 403 on streams | Enable per-channel proxy in channel settings |
| App not in My Apps | Restart TV, check Developer Mode |

---

## Links

- [Releases](https://github.com/Nur-allhi/en-tvplayer/releases) — Download WGT files
- [Tizen Community Packages](https://github.com/Apps2Samsung/tizen-community-packages) — Included in community bundle
- [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung) — Easy TV installer
- [Report Bugs](https://github.com/Nur-allhi/en-tvplayer/issues)

---

## License

MIT
