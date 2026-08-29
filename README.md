# EN TV Player

**Samsung Tizen TV IPTV Player** — Play DRM-protected IPTV channels on your Tizen TV.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tizen](https://img.shields.io/badge/Tizen-5.0+-red?logo=samsung)]()
[![Version](https://img.shields.io/badge/version-1.1.0-blue)]()

---

## Why This App?

Samsung Tizen TVs have issues playing **DRM-protected IPTV channels**. Most IPTV players don't work properly on Tizen.

**EN TV Player solves this.**

- ✅ Plays DRM-protected channels (ClearKey, PlayReady)
- ✅ Works on Samsung Tizen 5.0+ TVs
- ✅ No server required — just paste your playlist URL
- ✅ Free and open source

---

## Quick Install

### Option 1: Apps2Samsung (Recommended)

1. Download [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung/releases)
2. Enable Developer Mode on your TV (press `1-2-3-4-5` in Apps menu)
3. Enter your TV's IP in Apps2Samsung
4. Download `EN-IPTV_Player.wgt` from [Releases](https://github.com/Nur-allhi/en-tvplayer/releases/tag/v1.1.0)
5. Click "Install"

### Option 2: Tizen Studio CLI

```bash
tizen install -n EN-IPTV_Player.wgt -s <TV_IP>
```

---

## Features

- **DRM Support** — ClearKey and PlayReady for protected channels
- **No Server Required** — Fetches M3U8 playlists directly
- **M3U/M3U8 Support** — Works with any IPTV playlist
- **Channel Groups** — Organized by category
- **Per-Channel Proxy** — Toggle proxy for channels that need it

---

## Remote Control

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate channel list |
| ← / → | Open/close sidebar |
| Enter | Select channel |
| Back | Close menu |
| Volume ↑/↓ | Adjust volume |

---

## How to Use

1. Install the app on your TV
2. Open from "My Apps"
3. Settings page opens automatically
4. Paste your M3U/M3U8 playlist URL
5. Click "Fetch Playlist"
6. Start watching!

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| DRM channel won't play | This app supports ClearKey/PlayReady — it should work |
| Channel list empty | Paste your M3U URL in Settings |
| App not in My Apps | Restart TV, check Developer Mode |

---

## Links

- [Releases](https://github.com/Nur-allhi/en-tvplayer/releases) — Download WGT
- [Tizen Community Packages](https://github.com/Apps2Samsung/tizen-community-packages)
- [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung) — Easy installer
- [Report Bugs](https://github.com/Nur-allhi/en-tvplayer/issues)

---

## 🐛 Report Bugs & 💡 Request Features

Found a bug or have an idea? Open an issue on [GitHub Issues](https://github.com/Nur-allhi/en-tvplayer/issues).

### Rules

1. **Search first** — check if the issue already exists before creating a new one.
2. **One issue per ticket** — don't mix multiple bugs or features into one issue.
3. **Be specific** — vague issues are hard to reproduce and fix.
4. **Stay respectful** — keep the discussion constructive.

### Bug Report Format

```
Title: [Bug] Short description

TV Model: e.g. Samsung TU8000
Tizen Version: e.g. 5.0
App Version: e.g. 1.1.0

Steps to Reproduce:
1. Open the app
2. ...
3. ...

Expected Behavior: What should happen
Actual Behavior: What actually happens

Screenshots/Videos: (if applicable)
```

### Feature Request Format

```
Title: [Feature] Short description

Description: What you want and why
Use Case: How this helps you or other users

Alternatives Considered: Any workarounds you already tried
```

---

## License

MIT

---

## ⭐ Support the Project

If you find EN TV Player useful, please consider giving it a ⭐ star on GitHub!

It helps others discover the project and motivates continued development.

**Star the repo:** [github.com/Nur-allhi/en-tvplayer](https://github.com/Nur-allhi/en-tvplayer)

Thank you for your support! 🙏
