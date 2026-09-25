# TICKETS — EN TV Player

> **Version:** 1.1 · **Date:** 2026-08-28
> **Rule:** One ticket = one branch = one merge. Atomic.

---

## Milestone v1.1.1 — "Bug Fixes"

### T-001: Remove debug console.log statements
- **Skills:** `senior-frontend`
- **Fixes:** BUG-001
- **Spec:** Remove all `[DEBUG]` console.log from `main.js`. Keep only error/warning logs.
- **Acceptance:** No debug output in browser console during normal use.
- **LOC:** ≤ 20

### T-002: Remove excessive proxy logging
- **Skills:** `senior-frontend`
- **Fixes:** BUG-003
- **Spec:** Remove `[PROXY] SKIP/PROC` logs from `player.js`. Keep only error logs.
- **Acceptance:** No proxy debug output in console.
- **LOC:** ≤ 15

### T-003: Fix documentation for unimplemented features
- **Skills:** `senior-frontend`
- **Fixes:** BUG-004
- **Spec:** Remove "Favorite toggle" from remote control docs until T-021 is implemented. Update README and AGENTS.md.
- **Acceptance:** Documentation matches actual features.
- **LOC:** docs only

### T-004: Add warning for tizen key registration failure
- **Skills:** `senior-frontend`
- **Fixes:** BUG-006
- **Spec:** Log warning when `registerKey` fails instead of silent catch.
- **Acceptance:** Warning appears in console if registration fails.
- **LOC:** ≤ 10

---

## Milestone v1.2.0 — "Daily Driver"

### T-010: Remember last channel
- **Skills:** `senior-frontend`
- **Spec:** Persist `lastChannelIndex` on every successful load; boot plays it directly
- **Acceptance:** Restart resumes same channel; boot→video ≤3s from cache
- **LOC:** ≤ 40

### T-011: Favorites + recents
- **Skills:** `senior-frontend`
- **Spec:** Red-key toggle on current channel; `favorites: url[]` in localStorage; "Favorites" pinned group at top
- **Acceptance:** Favorite persists across restart; groups list shows pinned section
- **LOC:** ≤ 150

### T-012: Info bar with clock
- **Skills:** `senior-frontend`
- **Spec:** Extends OSD: number, name, group, format, resolution, clock; 8s auto-hide
- **Acceptance:** Shows on channel change; hides per timer
- **LOC:** ≤ 120

---

## Milestone v1.3.0 — "Code Quality"

### T-020: Split main.js into modules
- **Skills:** `senior-frontend`
- **Fixes:** BUG-002 (partial)
- **Spec:** Split `main.js` (647 LOC) into `main.js` + `state.js` + `handlers.js`. Each ≤ 300 LOC.
- **Acceptance:** All files ≤ 300 LOC; behavior unchanged.
- **LOC:** net 0

### T-021: Split player.js into modules
- **Skills:** `senior-frontend`
- **Fixes:** BUG-002 (partial)
- **Spec:** Split `player.js` (613 LOC) into `player.js` + `stream.js`. Each ≤ 300 LOC.
- **Acceptance:** All files ≤ 300 LOC; behavior unchanged.
- **LOC:** net 0

### T-022: Split settings.js into modules
- **Skills:** `senior-frontend`
- **Fixes:** BUG-002 (partial)
- **Spec:** Split `settings.js` (713 LOC) into `settings.js` + `playlists.js`. Each ≤ 300 LOC.
- **Acceptance:** All files ≤ 300 LOC; behavior unchanged.
- **LOC:** net 0

### T-023: Split ui.js into modules
- **Skills:** `senior-frontend`
- **Fixes:** BUG-002 (partial)
- **Spec:** Split `ui.js` (838 LOC) into `ui.js` + `sidebar.js` + `osd.js`. Each ≤ 300 LOC.
- **Acceptance:** All files ≤ 300 LOC; behavior unchanged.
- **LOC:** net 0

### T-024: Consistent innerHTML safety
- **Skills:** `code-reviewer`
- **Fixes:** BUG-005
- **Spec:** Audit all innerHTML usage. Use textContent where possible, escapeHtml for dynamic content.
- **Acceptance:** No unescaped dynamic content in innerHTML.
- **LOC:** ≤ 50

---

## Milestone v2.0.0 — "Real TV Experience"

### T-030: Now/next mini-EPG (XMLTV)
- **Skills:** `senior-backend` + `senior-frontend`

### T-031: Audio/subtitle track menus
- **Skills:** `senior-frontend`

### T-032: Parental lock (PIN group)
- **Skills:** `senior-frontend` + `code-reviewer`

---

## Milestone v2.1.0 — "Kodi Compat"

### T-033: Custom stream headers via #KODIPROP
- **Skills:** `senior-frontend`
- **Spec:** Parse `#KODIPROP:inputstream.adaptive.stream_headers=Key=Val&...` in `parseM3u()` (`player/src/utils.js`). URL-decode values, merge into `customHeaders` (plus `userAgent` for `User-Agent=`). Forward ALL headers in Shaka request filter (`player/src/player.js`), not just UA/Referer/Origin.
- **Acceptance:** Example playlist with `User-Agent=Mozilla/5.0&Referer=https://example.com` + `Authorization=Bearer x` lands on `channel.customHeaders` and is sent on Shaka manifest/segment requests; existing `#EXTHTTP`/`#EXTVLCOPT`/pipe headers keep working.
- **LOC:** ≤ 60

### T-034: Multi-key ClearKey DRM via #KODIPROP
- **Skills:** `senior-frontend`
- **Spec:** Parse `#KODIPROP:inputstream.adaptive.license_key=` dict forms `{KID1:KEY1,KID2:KEY2}` (unquoted) and `{"KID1":"KEY1",...}` (JSON) in `parseM3u()`. Normalize lowercase hex. Shape: `drm = { keyId, key, clearKeys }`. Wire `clearKeys` map into `player.configure({ drm })` in `loadChannel()`.
- **Acceptance:** Both dict formats + legacy single `KID:KEY` produce correct `clearKeys` for Shaka; single-key playlists unchanged.
- **LOC:** ≤ 60

---

## Milestone v2.3.0 — "Playlist & Discovery"

### T-035: Provider-order channel sorting (default)
- **Skills:** `senior-frontend`
- **Spec:** Add `channelSort: 'provider'` default in `player/src/config.js`. Settings → Playback gets a "Channel order" toggle row (Provider order ↔ A–Z). `sortChannels()` in `player/src/main.js` is skipped entirely in provider mode (parse/API order kept); `channelNumber` already equals file position so number-jump stays consistent. Migration note in release notes: existing installs reorder on update.
- **Acceptance:** Fresh default install lists channels in playlist file order; flipping to A–Z applies on next playlist refresh; number-jump hits the same channels in both modes.
- **LOC:** ≤ 30

### T-036: Hide groups (global list)
- **Skills:** `senior-frontend`
- **Spec:** Add global `hiddenGroups: []` (group names) in `player/src/config.js`. Settings gains a Groups manager (one toggle row per known group, persisted on flip). `extractGroups()` + `getDisplayChannels()` in `player/src/ui.js` exclude hidden names everywhere (list, number-jump, search). Complements T-032 (PIN lock stays a separate future ticket — hiding is not locking).
- **Acceptance:** Hiding "Adult" removes it from group list, channel list, number-jump and search; unhiding restores it; empty-state copy still reads correctly with all groups hidden.
- **LOC:** ≤ 80

### T-037: Cross-group channel search
- **Skills:** `senior-frontend` + `ui-ux-pro-max`
- **Spec:** Pin a 🔍 Search row first in the group list (`player/src/ui.js`). Selecting it opens a text input reusing the playlist-field TV-keyboard/IME flow; live-filter channels across all visible groups (hidden groups excluded). OK tunes into context, Back returns to groups, empty query exits. Remote cases in `player/src/remote.js` + `player/src/main.js`, styles in `player/src/styles.css`.
- **Acceptance:** Remote-only flow finds and tunes a channel from another group; hidden-group channels never surface; Back always lands back on groups.
- **LOC:** ≤ 130

### T-038: Native Xtream Codes login
- **Skills:** `senior-frontend` + `code-reviewer`
- **Spec:** New `player/src/xtream.js`: `login(host, user, pass)` surfacing auth/expired errors from `player_api.php?username&password`, and `fetchXtreamChannels()` mapping `get_live_categories` → `group` and `get_live_streams` → `{host}/live/{u}/{p}/{stream_id}.m3u8`, keeping provider `num` order. Playlist entry gains `{type:'xtream', host, username, password}`; Source card add/edit forms gain type selector + credential fields + Test-connection button; `fetchPlaylist()` dispatches by type. Live TV only — VOD/series explicitly out of scope. Credentials live in localStorage (note in `docs/SECURITY.md`).
- **Acceptance:** Valid login imports categories as groups and streams as playable channels; wrong credentials and expired lines show plain-language errors; M3U playlists unchanged.
- **LOC:** ≤ 250

---

**Sequencing:** T-001 → T-002 → T-003 → T-004 → v1.1.1 release → T-010 → T-011 → T-012 → v1.2.0 → T-020..T-024 → v1.3.0
