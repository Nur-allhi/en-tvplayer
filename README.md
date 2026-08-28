# EN TV Player

**Samsung Tizen TV IPTV Player** — Install on any Tizen 5.0+ TV via Developer Mode or USB.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tizen](https://img.shields.io/badge/Tizen-5.0+-red?logo=samsung)]()
[![Version](https://img.shields.io/badge/version-1.1.0-blue)]()

---

## Quick Install

1. Download [`releases/EN-IPTV_Player_v1.1.0.zip`](releases/EN-IPTV_Player_v1.1.0.zip)
2. Extract to get the `.wgt` file
3. Install via [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download) or USB
4. Open from "My Apps" on your TV

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

### Install the WGT

**Option A — Tizen Studio CLI:**
```bash
tizen install -n EN-IPTV_Player.wgt -s <TV_IP_ADDRESS>
```

**Option B — USB:**
1. Copy the `.wgt` file to a USB drive
2. Plug into TV
3. Install from the file manager

**Option C — Web:**
1. Open `http://<TV_IP>:23049` from your browser
2. Upload the `.wgt` file

### Start the App
- Open from "My Apps" on your TV
- Settings page opens automatically when no channels are loaded
- Enter your playlist URL or upload an M3U file

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

## Development

### Prerequisites
- Node.js 18+
- Python (for WGT packaging)
- OpenSSL (for signing)

### Build from Source

```bash
# Install dependencies
cd player && npm install && cd ..
cd tizen && npm install && cd ..

# Build player SPA
cd player && npm run build && cd ..

# Package WGT (outputs to releases/)
cd tizen && node package.mjs
```

### Project Structure

```
en-tvplayer/
├── player/              Player SPA (Vite + Shaka Player)
│   ├── src/             Source code
│   │   ├── main.js      App entry point
│   │   ├── player.js    Shaka Player wrapper
│   │   ├── ui.js        Channel list + sidebar
│   │   ├── settings.js  Settings page
│   │   ├── remote.js    Remote control handler
│   │   ├── config.js    localStorage settings
│   │   └── utils.js     Shared utilities
│   ├── public/          Static assets (favicon)
│   └── vite.config.js   Vite configuration
├── tizen/               WGT build tools
│   ├── package.mjs      Build + sign script
│   ├── config.xml       Tizen app manifest
│   ├── icons/           App icons
│   └── ziphelper.py     ZIP packaging helper
├── releases/            Pre-built WGT releases
└── README.md
```

---

## Remote Control Keys

| Key | Action |
|-----|--------|
| ↑ / ↓ | Previous / Next channel |
| ← / → | Navigate menus / Toggle sidebar |
| Enter | Select / Play |
| Back | Close menu / Exit confirm |
| 0–9 | Number pad (tune to channel) |
| Channel Up/Down | Next / Previous channel |
| Play/Pause | Toggle playback |
| Stop | Stop playback |
| Next/Prev | Next / Previous track |
| Red | Favorite toggle |
| Green | Groups sidebar |
| Yellow | Proxy toggle |
| Blue | Open settings |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| TV "Invalid certificate" | Delete `*.p12` + `profile.xml`, regenerate certs |
| App not in My Apps | Restart TV, check Developer Mode is enabled |
| Video won't play | Enable **Proxy** from the right sidebar for that channel |
| "Stream not loading" | Open right sidebar → toggle Proxy OFF to ON |
| Channel list empty | Settings page opens automatically — paste playlist URL |
| 403 on streams | Enable per-channel proxy or check header rules |

---

## Links

- [EN_TvPlayer (Full Project)](https://github.com/Nur-allhi/EN_TvPlayer) — Server + Proxy + Player
- [Releases](https://github.com/Nur-allhi/en-tvplayer/releases) — Download WGT files
- [Tizen Developer Docs](https://developer.tizen.org/development/tizen-studio/download)

---

## License

MIT
