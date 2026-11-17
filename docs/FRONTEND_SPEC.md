# FRONTEND SPEC — EN TV Player

> **Version:** 1.0 · **Date:** 2026-08-28
> **Context:** 10-foot UI on Samsung TV remote. Desktop is preview only.

---

## 1. Design Principles

1. **Remote-first:** Every state reachable with Arrows + Enter + Back + number pad
2. **Fixed px sizing:** 1920×1080 CSS px (Tizen compatibility)
3. **Focus always visible:** One focused element per state; 3px accent outline
4. **Nothing destructive without confirmation**
5. **Minimum DOM:** Virtualized lists, reusable overlays

---

## 2. Screens & States

| State | Visible | Notes |
|-------|---------|-------|
| `PLAYER` | Video + OSD | Default after boot |
| `SIDEBAR_GROUPS` | Left sidebar (groups + 🎬 Library) | From PLAYER via Left |
| `SIDEBAR_CHANNELS` | Left sidebar (channels) | From SIDEBAR_GROUPS via Enter |
| `LIBRARY` | Movies / Series list | From SIDEBAR_GROUPS → 🎬 Library |
| `LIBRARY_DETAIL` | Detail + Resume + Episodes | OK on a title |
| `EPISODES` | Season/episode list | OK on a series |
| `RIGHT_MENU` | Right sidebar (Audio, Subtitles, Quality, Actions) | From PLAYER via Right |
| `SETTINGS` | Full-screen settings (3 sections) | From RIGHT_MENU → Settings |
| `DIALOG` | Modal over any state | Confirm exit/delete |

---

## 3. Global Key Map

| Key | PLAYER | SIDEBAR | RIGHT_MENU | SETTINGS | DIALOG |
|-----|--------|---------|------------|----------|--------|
| Up/Down | prev/next channel | move focus | move focus | move focus | move focus |
| Left | open SIDEBAR | back to groups | close | focus nav tabs | — |
| Right | open RIGHT_MENU | jump to RIGHT_MENU | move focus | focus content | — |
| Enter | toggle SIDEBAR | play/enter group | activate item | activate/toggle | confirm |
| Back | exit-confirm DIALOG | collapse sidebar | close | close → player | dismiss |
| ChUp/ChDown | prev/next channel | — | — | — | — |
| Play/Pause | toggle playback | toggle playback | — | — | — |
| 0-9 | tune by number | same | — | — | — |
| Red | favorite | — | — | — | — |
| Green | open SIDEBAR | — | — | — | — |
| Yellow | toggle proxy | — | — | — | — |
| Blue | open SETTINGS | — | — | — | — |

**Library states:** Up/Down moves through titles/episodes, OK enters a level,
Back returns exactly one level (never strands), Left exits to groups. On a
detail card, "▶ Play" and "↻ Resume at m:ss" are separate focusable rows.

**Right menu (VOD):** Audio and Quality list real tracks from the loaded stream;
Subtitles is a remote-friendly cycle button (`Off` → available tracks).

---

## 4. Visual System

- **Background:** #000000 (pure black)
- **Accent:** #ED421F (orange-red)
- **Text:** #FFFFFF (primary), #AAAAAA (secondary)
- **Focus:** 3px solid #ED421F + background lift
- **Font:** system-default, 28px base

---

## 5. Component States

| Component | States |
|-----------|--------|
| Channel item | normal, focused, playing, proxy-enabled |
| Button | normal, focused, disabled |
| Input | normal, focused, error |
| Overlay | visible, hidden |
