# 📺 EN TV Player

**The IPTV player for Samsung Tizen TVs** — plays DRM-protected channels other players can't, with no server required.

[![Downloads](https://img.shields.io/github/downloads/Nur-allhi/en-tvplayer/total)](https://github.com/Nur-allhi/en-tvplayer/releases)
[![Latest release](https://img.shields.io/github/v/release/Nur-allhi/en-tvplayer)](https://github.com/Nur-allhi/en-tvplayer/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tizen](https://img.shields.io/badge/Tizen-5.0+-red?logo=samsung)]()

> **Current version: v3.2.0** — [see what's new](CHANGELOG.md) · [download](https://github.com/Nur-allhi/en-tvplayer/releases/latest)
>
> **Looking for** a Samsung Tizen IPTV player — an M3U/M3U8 playlist player for Samsung Smart TV, sideloaded as a `.wgt` file, that plays DRM-protected (ClearKey / PlayReady) channels? That's this app.

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
| 📃 Playlists | M3U/M3U8 + Xtream login, multiple saved playlists, auto-refresh on launch |
| 🗂️ Organization | Channel groups (hideable), provider order or A–Z, cross-group search, number jump |
| ✨ First run | Source picker: M3U or Xtream right after install |
| 🎚️ Per-channel proxy | Testing relay for stubborn streams (desktop, opt-in via Settings) |
| 📶 Smart playback | Auto quality, stream-format auto-detection, live-token retry |
| 🔔 Update checker | Opt-in notice when a new version is available |
| 🎮 Remote-first | Full Samsung remote support incl. color keys & channel up/down |

---

## ⚠️ Limitations

Samsung TVs are closed hardware with real limits — here is what the app can and cannot do about them:

- **DRM systems:** ClearKey and PlayReady channels are supported. Channels using any other protection system will not play — there is no workaround for that.
- **Picture quality:** Auto quality stays at FHD or below, because higher variants stall on most Tizen hardware and connections. You can still pick a higher quality manually from the menu if your TV and line handle it.
- **Odd codecs:** Streams the TV browser cannot decode are retried through the TV's built-in player. A few exotic formats will not play in either — try a native player app for those.
- **Fast switching on protected channels:** the TV has a limited number of decoder key sessions. After very rapid zapping a channel can miss its start — just select it again from the list.
- **Slow servers:** if the relay itself is slow, channels buffer no matter the app. The status line tells you what is happening; waiting or picking another channel are the only fixes.

---

## 🎮 Remote Control

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate channel list |
| ← / → | Open/close sidebar |
| Enter | Select channel |
| Back | Close menu / exit |
| Volume ↑/↓ | Adjust volume |
| Red / Green / Yellow / Blue | Green: groups · Blue: settings (Red/Yellow reserved) |
| Channel Up/Down | Previous / next channel |
| Numbers | Jump to channel |

---

## 📖 First Run

1. Install the app and open it from "My Apps"
2. Pick a source: **M3U / M3U8 Playlist** or **Xtream Login**
3. Paste your playlist URL (or enter host + username + password) → Save → Fetch
4. Start watching! The app can auto-refresh your playlist on every launch (Settings → Playback)

---

## 🛟 Troubleshooting

| Problem | Solution |
|---------|----------|
| Channel won't play | Check the playlist URL, try a fixed quality from the menu, or another channel |
| Channel doesn't start after fast switching | Open the channel list and select the same channel again — the first attempt can lose a race on slow servers |
| "Update available" badge | Reinstall via Apps2Samsung — settings are kept |
| Channel list empty | Re-paste your M3U URL in Settings → Channel Source |
| App missing from My Apps | Restart the TV, verify Developer Mode is still on |

---

## 🌱 Improvements

EN TV Player gets better with every release, driven by real reports from TV owners — see the [changelog](CHANGELOG.md) for what's already fixed. Got an idea? Open a ticket under [Bugs & Feature Requests](#-bugs--feature-requests).

---

## 💬 Contact

> **A hobby project:** EN TV Player is built and maintained by one person in their spare time. There are no ETAs and no guaranteed fixes — clear, reproducible reports (see below) always get attention first. Thank you for understanding! 🙏

Questions, broken channels, or just want to say hi? Join the channel: **[@eniptvplayer](https://t.me/eniptvplayer)**

---

## 🐛 Bugs & 💡 Feature Requests

Prefer GitHub? Open a ticket on [GitHub Issues](https://github.com/Nur-allhi/en-tvplayer/issues).

**Rules:** search first · one issue per ticket · stay respectful — and describe it properly so it can actually be fixed:

- **What** happened vs. what you expected
- **When** it happens — every time, only after fast switching, only some channels (which ones?)
- **Versions** — app version, TV model, Tizen version, playlist type (M3U or Xtream)
- **Logs** — inspector console lines around the moment, if you can grab them
- **Privacy** — never post playlist passwords or private stream links

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
