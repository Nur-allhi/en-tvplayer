# 📺 EN TV Player

**The IPTV player for Samsung Tizen TVs** — plays DRM-protected channels other players can't, with no server required.

[![Downloads](https://img.shields.io/github/downloads/Nur-allhi/en-tvplayer/total)](https://github.com/Nur-allhi/en-tvplayer/releases)
[![Latest release](https://img.shields.io/github/v/release/Nur-allhi/en-tvplayer)](https://github.com/Nur-allhi/en-tvplayer/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tizen](https://img.shields.io/badge/Tizen-5.0+-red?logo=samsung)]()

> **Current version: v1.9.0** — [see what's new](CHANGELOG.md) · [download](https://github.com/Nur-allhi/en-tvplayer/releases/latest)

---

## Why EN TV Player?

Most IPTV players fail on Samsung Tizen TVs when channels are **DRM-protected**. EN TV Player was built to solve exactly that.

- 🔓 **DRM that works** — ClearKey and PlayReady channels play where other players show black screens
- 📡 **No server needed** — paste your M3U/M3U8 playlist URL and watch
- 📺 **Built for the 10-foot experience** — full remote support, big readable UI, channel groups
- 🔄 **Stays current** — optional in-app update checker tells you when a new version drops
- 🔒 **Private by default** — everything stays on your TV; usage stats are strictly opt-in
- 🆓 **Free and open source (MIT)**

---

## 🚀 Install

### Option 1: Apps2Samsung (recommended)

1. Download [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung/releases)
2. Enable Developer Mode on your TV (press `1-2-3-4-5` in the Apps menu)
3. Enter your TV's IP in Apps2Samsung
4. Pick **EN TV Player** from the community catalog (or your downloaded `.wgt`) and click Install
5. Re-run the installer whenever the app tells you an update is available

### Option 2: Tizen Studio CLI

```bash
tizen install -n EN-IPTV_Player.wgt -s <TV_IP>
```

> Updates must be signed with the same key — reinstalling never touches your channels or settings.

---

## ✨ Features

| | |
|---|---|
| 🔓 DRM playback | ClearKey + PlayReady protected channels |
| 📃 Playlists | M3U/M3U8, multiple saved playlists, auto-refresh on launch |
| 🗂️ Organization | Channel groups, alphabetical sorting, fast number jump |
| 🎚️ Per-channel proxy | Toggle proxy per channel for stubborn streams |
| 📶 Smart playback | Auto quality, stream-format auto-detection, live-token retry |
| 🔔 Update checker | Opt-in notice when a new version is available |
| 🎮 Remote-first | Full Samsung remote support incl. color keys & channel up/down |

---

## 🎮 Remote Control

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate channel list |
| ← / → | Open/close sidebar |
| Enter | Select channel |
| Back | Close menu / exit |
| Volume ↑/↓ | Adjust volume |
| Red / Green / Yellow / Blue | Shortcuts (menu, groups, proxy, settings) |
| Channel Up/Down | Previous / next channel |
| Numbers | Jump to channel |

---

## 📖 First Run

1. Install the app and open it from "My Apps"
2. The Settings page opens automatically
3. Paste your M3U/M3U8 playlist URL → Fetch
4. Start watching! The app can auto-refresh your playlist on every launch (Settings → Playback)

---

## 🛟 Troubleshooting

| Problem | Solution |
|---------|----------|
| Channel won't play | Try enabling **Proxy** for that channel from the menu |
| "Update available" badge | Reinstall via Apps2Samsung — settings are kept |
| Channel list empty | Re-paste your M3U URL in Settings → Channel Source |
| App missing from My Apps | Restart the TV, verify Developer Mode is still on |

---

## 💬 Contact

Questions, broken channels, or just want to say hi? Message me directly on Telegram: **[@nureallhiii](https://t.me/nureallhiii)**

---

## 🐛 Bugs & 💡 Feature Requests

Prefer GitHub? Open a ticket on [GitHub Issues](https://github.com/Nur-allhi/en-tvplayer/issues).

**Rules:** search first · one issue per ticket · be specific (TV model, Tizen version, app version, steps to reproduce) · stay respectful.

---

## 🔗 Links

- [Releases](https://github.com/Nur-allhi/en-tvplayer/releases) — download the WGT
- [Changelog](CHANGELOG.md) — what changed in each version
- [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung) — easy installer
- [Tizen Community Packages](https://github.com/Apps2Samsung/tizen-community-packages)

---

## License

MIT — see [LICENSE](LICENSE).

⭐ If EN TV Player is useful to you, a star on GitHub helps others find it. Thank you! 🙏
