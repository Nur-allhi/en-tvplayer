# BUGS — EN TV Player (Bug Tracker)

> Log bugs immediately. Never delete entries. Resolved bugs move to bottom.

---

## BUG-001: Debug console.log statements in production code

- **Status:** fixed
- **Severity:** medium
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/main.js:69,71,207,217`
- **Description:** Multiple `[DEBUG]` console.log statements left in production code. These leak internal state to users and clutter the console.
- **Expected:** No debug logs in production builds.

---

## BUG-002: Files exceed 300 LOC limit

- **Status:** deferred (too risky without tests)
- **Severity:** medium
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** Multiple files
- **Description:** Several files exceed the 300 LOC limit defined in AGENTS.md:
  - `main.js` — 665 LOC
  - `player.js` — 610 LOC
  - `settings.js` — 713 LOC
  - `ui.js` — 838 LOC
- **Expected:** Each file ≤ 300 LOC.
- **Resolution:** Deferred due to tight coupling and lack of tests. Splitting would risk breaking the app. See docs/FILE_SPLIT_PLAN.md for future reference.

---

## BUG-003: Excessive proxy debug logging

- **Status:** open
- **Severity:** low
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/player.js:66,70,76`
- **Description:** Verbose proxy logging (`[PROXY] SKIP`, `[PROXY] PROC`) in production. Leaks URL information.
- **Expected:** Minimal or no logging in production.

---

## BUG-004: Unimplemented feature (TODO)

- **Status:** fixed
- **Severity:** low
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/main.js:573`
- **Description:** `// TODO T-021: toggle favorite` — Favorite toggle not implemented but Red key is documented as "Favorite toggle".
- **Expected:** Either implement or remove from documentation.

---

## BUG-005: innerHTML usage without escapeHtml

- **Status:** closed (not an issue)
- **Severity:** medium
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/main.js:20,154,158`
- **Description:** Some innerHTML assignments use static strings (safe), but pattern is inconsistent. Should use textContent where possible.
- **Resolution:** All user content is already escaped with `escapeHtml()`. innerHTML usages are either static strings, HTML entities for icons, or properly escaped user content. No security issue found.

---

## BUG-006: Missing error handling in tizen key registration

- **Status:** fixed
- **Severity:** low
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/main.js:362`
- **Description:** `try { window.tizen.tvinputdevice.registerKey(key); } catch (e) {}` — Silent catch with no fallback.
- **Expected:** Log warning or handle gracefully.

---

## BUG-007: No cleanup of event listeners on destroy

- **Status:** fixed
- **Severity:** low
- **Found:** 2026-08-28 (during: code analysis)
- **Location:** `player/src/main.js` (multiple)
- **Description:** Event listeners added but never removed. Not critical for SPA but could cause issues if player is reinitialized.
- **Expected:** Cleanup function for event listeners.

---

## BUG-008: Playlist fetch fails on fresh install

- **Status:** fixed
- **Severity:** high
- **Found:** 2026-08-28 (user reported)
- **Location:** `player/src/main.js` — `showFirstLaunch()` callback
- **Description:** On fresh install, adding a playlist and clicking "Fetch Active" does nothing. The player never starts. User must force-close and reopen the app.
- **Root Cause:** `showFirstLaunch()`'s `onPlaylistFetched` callback calls `ui.stopInactivityTimer()` BEFORE `ui.init()` has been called. This throws an error that is silently caught by an empty `catch(e) {}` block. The fetch itself succeeds (channels saved to localStorage), but the player never starts.
- **Fix:** Removed premature `ui.stopInactivityTimer()` call. Added `console.error()` to catch block.

---

## BUG-009: Fetch Active intermittent error during stream playback

- **Status:** open
- **Severity:** high
- **Found:** 2026-08-31 (user reported)
- **Location:** `player/src/utils.js:102-132` (`fetchPlaylist`), `player/src/settings.js:668-690` (`handleFetch`)
- **Description:** While a stream is actively playing, clicking "Fetch Active" in settings sometimes shows a generic error (e.g., "Fetch timed out"). The error is intermittent — it works sometimes and fails other times.
- **Root Cause:** Two compounding issues:
  1. **`fetchPlaylist` relay fallback has no inner try-catch.** When the direct `fetch(url)` fails (timeout, CORS, network congestion from active stream), the catch block tries a relay endpoint (`/api/fetch?url=...`). On Tizen TV, this relay endpoint does not exist, so `fetchWithTimeout(relayUrl, ...)` itself throws. This relay error is **not caught** — it propagates up with an unhelpful message like "Fetch timed out" instead of the actual cause.
  2. **No double-click protection on Fetch Active button.** The button doesn't disable during fetch, so rapid clicks can trigger multiple concurrent fetch operations, compounding network congestion.
- **Expected:** `fetchPlaylist` should gracefully handle relay failures and show a meaningful error. The Fetch Active button should disable during operation.
- **Fix:** Wrapped relay fallback in its own try-catch. Added button disable during fetch. Added user-friendly error messages.

---

## BUG-010: Some IPTV channels show black screen with no error

- **Status:** fixed
- **Severity:** critical
- **Found:** 2026-09-03 (user reported, model: Samsung 55M2EHAU)
- **Location:** `player/src/player.js`, `player/src/config.js`
- **Description:** Some M3U channels play fine while others show a persistent black screen with no error message. Same channels work on other IPTV players (TiviMate, IPTV Smarters, etc.).
- **Root Causes (5 compounding issues):**
  1. **No MIME type hint for direct TS stream URLs.** IPTV playlists contain raw `.ts` stream URLs (e.g. `http://server:8080/1234`). Shaka Player cannot auto-detect the MIME type for these URLs, causing it to silently fail to render video. Without `video/mp2t` hint, Shaka treats the response as an unknown format.
  2. **`manifest.hls.ignoreManifestProgramDateTime: true`** in config.js. This forces Shaka to ignore HLS date-time synchronization. Streams that rely on `EXT-X-PROGRAM-DATE-TIME` for A/V sync break — video loads but never renders (black screen).
  3. **Missing `forceTransmuxTS: true`** in streaming config. Direct TS segments from IPTV servers need transmuxing to work with MSE (Media Source Extensions) on Tizen. Without this, TS segments fail silently.
  4. **Missing HLS segment format hint.** Many IPTV HLS streams use MPEG-TS segments (not fMP4). Without `segmentFormat: 'mpegts'`, Shaka defaults to fMP4 which these streams don't have.
  5. **No video element error listener.** The native `<video>` element fires `error` and `stalled` events when decoding fails, but these were never captured. Shaka catches manifest-level errors but not browser-level codec failures.
- **Fix:**
  - Added `detectMimeType()` function that identifies `.ts`, `.mp4`, `.mkv`, `.flv` URLs and direct numeric paths (common IPTV pattern) and passes the correct MIME type to `player.load(url, undefined, mimeType)`
  - Changed `ignoreManifestProgramDateTime` from `true` to `false`
  - Added `forceTransmuxTS: true` to streaming config
  - Added `segmentFormat: 'mpegts'` and `segmentVideoCodec: 'h264'` to HLS config
  - Added `video.addEventListener('error')`, `stalled`, and `waiting` listeners to catch native playback failures
  - Added `onVideoError()` with debounce and 2-strike detection to show "stream format may not be supported" message
  - Reduced load timeout from 30s to 15s with visible error message instead of silent retry
  - Added reconnect limit (3 attempts) instead of infinite retry — shows clear error after exhausting retries
  - Improved all Shaka error messages with actionable hints (e.g. "try enabling Proxy", "codec not supported on this device")
  - Increased `bufferingGoal` from 10s to 15s and `bufferBehind` from 5s to 30s for more stable live stream playback
  - Reduced `segmentPrefetchLimit` from 5 to 3 to prevent memory pressure on low-end Tizen TVs

---

## BUG-011: Remote OK on Settings does not save — playlist edits lost, toggles revert

- **Status:** fixed (pending release)
- **Severity:** high
- **Found:** 2026-09-04 (user reported)
- **Location:** `player/src/settings.js` (`selectFocused()`)
- **Description:** Two user-facing symptoms with one root cause — the TV remote's OK button path (`selectFocused()`) did not run the same logic as a real click:
  1. **Playlist renames never saved.** The per-row Edit check `el.id.startsWith('pl-edit-')` also matched the edit form's `pl-edit-save` / `pl-edit-cancel` buttons (they share the prefix). Pressing OK on Save hit the row-edit branch first, parsed the index as `NaN`, and re-rendered without ever calling `saveSettings()` — the edited name/URL was silently discarded.
  2. **Auto quality (and Auto refresh) toggles reverted.** The toggle branch only did `classList.toggle('on')` (visual). The actual `saveSettings()` call lived in the DOM `click` listener, which was never triggered on TV. Leaving and reopening Playback re-read the old stored value, so the toggle appeared ON again.
- **Root Cause:** Remote input handled by duplicating click logic in `selectFocused()` instead of dispatching a real click; a fragile string-prefix match (`startsWith('pl-edit-')`) shadowed the form buttons.
- **Fix:**
  - Toggle branch now calls `el.click()` so the render-registered handler persists the setting and applies it to the player.
  - Row Edit/Delete prefix checks now require an integer suffix (`/^pl-edit-\d+$/`, `/^pl-delete-\d+$/`) so `pl-edit-save` / `pl-edit-cancel` reach their own handlers.
  - `show()` now resets `addMode` / `editMode`, so leaving Settings mid-edit no longer reopens a stale form.

---

## BUG-012: Enter/OK inside Settings text fields does nothing on TV — Proxy URL never saves, playlist forms don't submit

- **Status:** fixed (pending release)
- **Severity:** medium
- **Found:** 2026-09-04 (during: code audit)
- **Location:** `player/src/settings.js` (`selectFocused()`, `render()`)
- **Description:** Two symptoms, one root cause — the same remote-vs-desktop mismatch as BUG-011, but for text inputs:
  1. **Proxy URL never saves via Enter on TV.** On desktop, the proxy input has a `keydown` Enter listener that calls `handleProxySave()`. On TV the remote layer intercepts Enter while a text field is focused and routes it to `selectFocused()`, whose INPUT branch only re-focused the field (`el.focus()`) — so the desktop Enter-to-save path never ran. Users had to arrow down to the Save button and press OK.
  2. **OK inside playlist name/URL fields does nothing** (add and edit forms). Same interception: OK just re-focused the input instead of submitting the form, differing from Enter-on-desktop expectations.
- **Root Cause:** The remote Enter/OK path (`selectFocused()`) treated every focused INPUT as a no-op re-focus, so desktop keydown handlers and form-submit behavior were unreachable on TV.
- **Fix:** `selectFocused()` now acts like Enter on a desktop form when an input is focused:
  - `settings-proxy-url` → calls `handleProxySave()` directly (same action as the desktop Enter listener and the Save button).
  - Add/edit playlist forms → OK in the Name field moves focus to the URL field (`moveSettingsFocus()`); OK in the URL field saves via the same code paths as the Save buttons (`saveAddPlaylist()` / `saveEditPlaylist()`), which were extracted to remove the duplicated logic.

---

## BUG-013: "Cannot read properties of null (reading 'next')" error on some channels

- **Status:** fixed (pending release) — mitigation; confirmation still needed with a failing stream
- **Severity:** high
- **Found:** 2026-09-05 (user reported)
- **Location:** `player/src/player.js` (`loadChannel()`, `handlePlayerError()`, `initPlayer()`)
- **Description:** On some playlists the error "Cannot read properties of null (reading 'next')" pops up right after the app starts. Same playlists play fine in other IPTV players (e.g. ibocast).
- **Root Cause (confirmed):** The app auto-plays the first channel on boot (`startPlayer()` → `ui.selectChannel(0, true)`), so a channel that crashes during load surfaces its error immediately on launch. The crash itself is a native `TypeError` thrown **inside Shaka Player 5.2.7**, not in our code — our error box prints the raw engine message. The message exactly matches the known, **still-unfixed upstream Shaka bug** for HLS streams carrying `EXT-X-PROGRAM-DATE-TIME` tags (shaka-project/shaka-player#5014). The PDT-sync code that introduced it (upstream commit `8f9162f`, "Sync each segment against EXT-X-PROGRAM-DATE-TIME") is byte-identical between our pinned 5.2.7 and current Shaka `main`, so upgrading Shaka does **not** fix it.
- **Why it regressed in v1.7.0:** BUG-010's fix flipped `manifest.hls.ignoreManifestProgramDateTime` from `true` to `false`, enabling the PDT sync code path that crashes on these streams. v1.6.0 ignored PDT and never ran it.
- **Fix (mitigation):** When a channel load fails with a native crash (TypeError, no Shaka error code), the channel is retried **once with HLS program-date-time sync disabled** (`ignoreManifestProgramDateTime: true`) — the same behavior that shipped in v1.6.0 — so the crashing stream can start. The per-URL fallback only affects channels that actually crash; all other channels keep the full v1.7.0 config. If the fallback also fails, a clear message is shown (channel name + reason are logged) instead of the cryptic engine text.
- **Open item:** Needs verification on a TV with the failing playlist. If channels still fail after the fallback, the crash root cause is something else in Shaka's HLS/TS handling and a failing channel URL is required to pinpoint it.

---

## BUG-014: "Something went wrong while changing the playing position" message + channels that won't load

- **Status:** fixed (pending release)
- **Severity:** high
- **Found:** 2026-09-05 (user reported)
- **Location:** `player/src/player.js` (`getErrorMessage()`, `isRecoverable()`, `handlePlayerError()`, `loadChannel()`, new `probeChannelFormat()`)
- **Description:** Some channels show "Something went wrong while changing the playing position" and never load, although the same playlists play in other IPTV players.
- **Root Cause 1 (wrong message mapping):** Our error table was written for an **old Shaka numbering**. The app has always shipped Shaka 5.x, where error code **4000 is `UNABLE_TO_GUESS_MANIFEST_TYPE`** ("could not identify the stream format") — but the table described it as a seek error, so users saw a nonsense sentence. Several other entries (1000–1005, 2000–2006, 3000–3003) were also mapped to the wrong Shaka codes, so real failures showed misleading text. The 403 handling also read the status from `error.data[0]`, but in Shaka 5.x `BAD_HTTP_STATUS` is code **1001** and its HTTP status is **`data[1]`** — so the dedicated 403 retry/auto-advance logic never actually fired (403s were only retried by luck through the generic path).
- **Root Cause 2 (unidentifiable formats):** Shaka error 4000 is thrown when it cannot guess a stream's format — no file extension in the URL and no usable `Content-Type` from the server. Many IPTV servers hide channel type behind tokenized links (e.g. `/play/abc123`, `.php`), so Shaka gives up while other players (which sniff the actual bytes) play them fine.
- **Fix:**
  - Error messages, retry decisions and 403 handling corrected to Shaka 5.x codes (`1001 BAD_HTTP_STATUS` with status in `data[1]`, `1002 HTTP_ERROR`, `1003 TIMEOUT`, etc.). The nonsensical code-4000 text is replaced with a truthful, actionable message.
  - New `probeChannelFormat()`: when a load fails with error 4000, the app fetches the first bytes of the stream (honoring the channel's proxy, user-agent and custom headers, capped/aborted quickly) and identifies the format — HLS (`#EXTM3U`), DASH (`<MPD`), MP4 (`ftyp`) or MPEG-TS (0x47 sync bytes) — then retries the channel once with the correct format hint forced into Shaka. The result is cached per URL for the session.
  - Format-probe and compatibility retries are now cancelled if the user switches channels mid-retry (load-token guard).
- **Open item:** Needs verification on a TV with the affected playlist. If a channel still fails after format probing, its stream type is outside the four probed formats and a sample channel URL is needed.

---

## BUG-015: Proxy hint shows mid-screen instead of bottom center

- **Status:** fixed (pending release)
- **Severity:** low (cosmetic)
- **Found:** 2026-09-05 (user reported)
- **Location:** `player/src/styles.css` (`.proxy-toast` missing), `player/index.html`
- **Description:** The "Stream not loading — try enabling Proxy" toast appears in the middle (right-of-center) of the screen instead of bottom center, under the error message.
- **Root Cause:** The `.proxy-toast` element had **no CSS rules at all** since the initial release — no position, no background, nothing. The player container is a centered flexbox, so the unstyled toast was laid out as a flex item in the middle of the screen whenever it was shown.
- **Fix:** Added `.proxy-toast` styling — absolute position, horizontally centered, pinned just above the bottom Now Playing bar (below the error box), dark translucent background consistent with the progress toast.

---

## BUG-016: Settings back button has no right margin — sticks to the "Settings" title

- **Status:** fixed (pending release)
- **Severity:** low (cosmetic)
- **Found:** 2026-09-05 (user reported)
- **Location:** `player/src/styles.css` (`.page-title`), `player/src/settings.js` (`render()`)
- **Description:** In Settings, the on-screen back button (‹) touches the page title — no gap between them.
- **Root Cause:** The header is `<button>‹</button>` followed by a **bare text node** "Settings". The existing spacing rule `.page-title > * + * { margin-left: 13px; }` only applies between *element* siblings, so no gap is created next to the text.
- **Fix:** Added `margin-right: 13px` to `.page-title .back-btn`.

---

| Bug | Fixed | Commit |
|-----|-------|--------|
| BUG-008 | 2026-08-28 | fix/first-fetch-failure |
