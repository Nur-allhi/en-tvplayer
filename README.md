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

- **Full remote control** — Back key, color keys, number pad, all 14 Samsung remote actions
- **HLS / DASH / MSS** — All streaming formats via Shaka Player
- **DRM support** — ClearKey, PlayReady (including DRM license from MPD URL)
- **Per-channel proxy toggle** — Enable/disable CORS proxy per channel, persists via localStorage
- **Virtualized channel list** — Handles 5,000+ channels smoothly
- **Settings page** — Playlist management, proxy config, about info
- **Local network only** — No external servers, no cloud, no telemetry

---

## Samsung TV Setup

### Enable Developer Mode

1. Go to `Menu` → `Apps` → press `1-2-3-4-5` on your remote
2. Enable "Developer Mode" and enter your PC's IP address
3. Restart the TV

### Start the App

1. Open from "My Apps" on your TV
2. Settings page opens automatically when no channels are loaded
3. Enter your playlist URL or upload an M3U file

---

## Server Connection

This player connects to an **EN IPTV Server** running on your local network.

**Default server:** `https://<YOUR_PC_IP>:5000`

### Setting Up the Server

```bash
# Clone the full project (includes server + proxy)
git clone https://github.com/Nur-allhi/EN_TvPlayer.git
cd EN_TvPlayer
npm install
npm start
```

This starts:
- **Server** on `:5000` — Channel API + static files
- **Proxy** on `:5001` — CORS proxy for streams

See [EN_TvPlayer](https://github.com/Nur-allhi/EN_TvPlayer) for full documentation.

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
| Channel list empty | Paste your M3U URL in Settings |
| 403 on streams | Enable per-channel proxy or check server |
| App not in My Apps | Restart TV, check Developer Mode |

---

## Links

- [EN_TvPlayer (Full Project)](https://github.com/Nur-allhi/EN_TvPlayer) — Server + Proxy + Player
- [Releases](https://github.com/Nur-allhi/en-tvplayer/releases) — Download WGT files
- [Tizen Community Packages](https://github.com/Apps2Samsung/tizen-community-packages) — Included in community bundle
- [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung) — Easy TV installer

---

## License

MIT
