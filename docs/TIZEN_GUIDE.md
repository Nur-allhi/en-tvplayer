# Tizen TV App Coding Guide — EN TV Player

> **Purpose:** everything this project learned about the gap between desktop
> browsers and Samsung Tizen TVs, written so any AI agent can build working
> TV UI + remote behavior from day 1. Tizen's Chromium is old and the TV
> remote is the only input — code for those two facts first.
>
> **Scope:** Samsung Tizen 5.0+ TV apps (HTML/CSS/JS, no framework).

---

## 1. Golden rules (read first)

1. **The remote is the mouse.** Every clickable thing must be reachable and
   operable with ↑ ↓ ← → + OK + Back. If it needs a mouse, it is broken.
2. **Tizen Chromium is ~5 years behind desktop.** Never use a CSS/JS feature
   without checking it exists on old Chromium. When in doubt, use the older
   pattern (§2).
3. **One visible focus at all times.** The user must always see where focus
   is. White inset rings on dark rows is the house pattern (§4).
4. **Never a blank or dead screen.** Loading veils, brand backdrops, empty
   states, and reason lines cover every gap (§6).
5. **The video plane floats above the web page** on Tizen. Any overlay that
   must be seen requires hiding the video element first (§6.3).

---

## 2. CSS that survives Tizen

### 2.1 Banned / risky properties

| Don't use | Use instead | Why |
|---|---|---|
| `gap` (flex/grid) | Sibling margins, e.g. `.row > * + * { margin-left: …; }` | Unsupported — items collapse together with zero error |
| `:scope` in selectors | Plain descendant selectors | Unreliable on old Chromium |
| `:has()` | Explicit classes toggled from JS | Unsupported |
| `backdrop-filter` as the only affordance | Solid `rgba()` fallback underneath | Often ignored |
| `100vh` for app layout | `100%` on `html, body` + fixed containers | TV viewport quirks |
| Sticky fancy scrollbars | `scrollbar-width: none` + programmatic scroll | Cosmetic, inconsistent |

### 2.2 TV scaling (do this from day 1)

- Define `--tv-scale` on `:root` from JS (`screen.width/1920`, minimum
  ~1.35 for couch readability) and size **everything** in
  `calc(Npx * var(--tv-scale))`. Fixed px text is unreadable at 10 feet.
- Fonts scale too: base `font-size: calc(26px * var(--tv-scale))` on `body`.
- See `player/src/main.js` → `applyResponsiveScale`, `player/src/styles.css`.

### 2.3 Focus + active + ellipsis patterns

- Rows: rounded cards (`border-radius`, vertical `margin`), `cursor: pointer`,
  `transition` on background/box-shadow only (transform jank on TV GPUs).
- Focused: light background + accent inset bar + **white inset ring**, e.g.
  `box-shadow: inset 4px 0 0 #ED421F, inset 0 0 0 2px #fff`.
- Playing/selected: tinted background + accent bar (no white ring — ring is
  reserved for *focus* so the two states never confuse).
- Long labels: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
  plus `min-width: 0` on every flex child that truncates (flex items refuse
  to shrink otherwise).
- Marquee only on the focused row; cancel the animation on focus move
  (`player/src/ui.js` → `startMarquee`/`stopMarquee`).

---

## 3. Remote control system

### 3.1 One global key layer

- Single `keydown` listener (capture phase) translating raw keys into app
  actions: `up/down/left/right/select/back/playpause/number/reload` plus
  Samsung names (`red/green/yellow/blue`, `play/pause/stop`,
  `channelUp/channelDown`, `next/prev`).
- Always `preventDefault()` handled keys — otherwise the TV chrome eats them.
- Handle **both** `e.key` strings and legacy `keyCode`s. Critical codes:
  `13` OK, `27`/`10009` Back (`10009` is Tizen's GoBack), `37–40` arrows,
  `48–57` + `e.key` digits for number jump.
- Number entry: buffer digits with a ~500 ms timeout, then jump
  (`player/src/remote.js`).

### 3.2 Register Tizen keys or they never arrive

- Special keys must be registered via
  `window.tizen.tvinputdevice.registerKey(...)`, guarded by feature checks.
- Register the **`ColorF0Red`-style names**, not `ColorRed` — but *handle*
  both spellings on input, plus `Media*`, `ChannelUp/Down`, `ChUp/ChDown`.
- Wrap every call in try/catch; log a warning, never crash
  (`player/src/main.js` → `registerTizenKeys`).
- Samsung's own Q&A confirms: unregistered keys silently never fire.

### 3.3 Bind every key you promise

- Never show a hint for a key with no handler (we shipped a "press BLUE"
  hint before color keys were bound — pure confusion). Either bind it or
  point at a working path (`player/src/ui.js` → `showFirstRunHint`).
- Color-key bindings live in one switch (`handleRemoteAction`): red/green/
  yellow/blue must do something discoverable (menu, groups, settings).

### 3.4 Back-button discipline

- Debounce Back (~600 ms) — TV remotes repeat.
- Back order: dialog → settings → sidebar → confirm-exit. Never exit on a
  single Back from content; ask via confirm dialog, exit via
  `tizen.application.getCurrentApplication().exit()`.

---

## 4. Focus (spatial navigation) system

Desktop tab-order does not exist for remote users. Build it:

1. **Focus order array** rebuilt from the live DOM (`buildFocusOrder`):
   nav items first, then content zone, then actions. Nulls allowed (queried
   elements may not exist) — `applyFocus` must null-check.
2. **One marker only**: `[data-focused]` attribute + `scrollIntoView({ block:
   'nearest' })` so the focused row never scrolls out of sight.
3. **Arrow semantics**: Up/Down = move in zone (wrap inside nav, linear in
   content); Left/Right = change zone (content ↔ nav) or traverse horizontal
   rows (playlist cards). Left from the first content item escapes to nav.
4. **Text inputs are focusable elements too** — include them in the order and
   call `.focus()` when landing on them (§5).
5. **Clear transient flags on every move** (`applyFocus` resets IME-engage
   markers, marquees, etc.).
6. **Mouse and remote coexist**: hover/click works, but remote focus is the
   source of truth — clicks must not strand `data-focused` elsewhere.

Reference: `player/src/settings.js` → `buildFocusOrder`/`applyFocus`/
`navigate`/`navigateNav`/`selectFocused`.

---

## 5. Text input + TV keyboard (IME)

This is the #1 desktop-to-TV trap. On desktop, Enter submits. On Tizen:

- The remote layer intercepts OK and routes it to `selectFocused()` — the
  input never sees the keypress.
- The IME (TV keyboard) opens on **explicit user-gesture focus**, not on
  programmatic `.focus()` from navigation code.
- Pattern that works (`selectFocused` input branch):
  1. **First OK** on a field (Tizen only — detect via
     `window.tizen && window.tizen.tvinputdevice`): `blur()` + `focus()` to
     hand focus to the IME and pop the keyboard. Mark the field engaged
     (`data-ime`). Desktop skips this step entirely.
  2. **Second OK** (field already engaged): advance to next field / save.
  3. Moving focus clears all engage markers.
- Layout bug we hit: `flex: 1` on an input with no flex parent does nothing
  — inputs rendered shrink-to-fit. Always pair with `width: 100%`.

---

## 6. Player surface rules

### 6.1 Tune sequence (never black, never double-spinner)

1. Set channel name → show full loading veil (spinner + centered name).
2. **Let the veil paint first**: `requestAnimationFrame` + ~30 ms sleep
   (350 ms safety cap) before tearing down the player — on TV the first
   paint otherwise happens only after load resolves.
3. Hide the `<video>` element immediately (see §6.3).
4. Exactly one indicator at a time: veil → buffering pill → picture.
   Hold Shaka `buffering` events during initial load; hand over after
   `load()` resolves (`initialLoadPending` in `player/src/player.js`).

### 6.2 Failure states show reasons, not codes

- User-facing errors are plain language with an action ("check playlist
  URL", "try another channel") — never HTTP codes, codec names, or "error
  4032". Keep a code→message map (`getErrorMessage`).
- Retry policy: polite retries with backoff for transient errors, fresh-token
  reload for 401/403 on tokenized streams, hard stop + advance after the
  cap. Never loop forever.
- Zero-frame watchdog: frames requested but never presented → migrate to
  native AVPlay fallback instead of sitting on black.

### 6.3 The video plane is on top

- On Tizen the video renders **above** the web layer: stale/black frames
  cover veils. Always `video.style.visibility = 'hidden'` at tune start,
  restore on `playing`.
- Overlays that must be visible (veils, pills) need high `z-index`
  (veil 30, pills 40, splash 200, modals 300) — and still lose to the video
  plane unless it is hidden.

### 6.4 Dead-air branding

- A faint centered logo backdrop (12% opacity) guarantees no pure-black void
  behind video/errors/empty states.
- A full brand block (logo + name + reason line) owns the screen when
  nothing can play: no channels ("add a playlist in Settings"), failed tune
  (error pill carries the reason), stopped. Hide it on first `playing` frame
  (`player/src/ui.js` → `showEmptyLogo`/`hideEmptyLogo`).
- Pause overlay: brand logo in the status circle instead of pause bars.

---

## 7. Boot splash staging

- Order: icon in → title types → tagline types → spinner/status → hold so
  the finished lockup can be **read** (~1.8 s) → zoom-into-logo exit → fade.
- Compute timing from the typewriter, never fixed sleeps: hold until
  `max(minimum, typewriterEnd)`, then exit. Fixed timers race slow devices.
- Completion callbacks, not timers, chain what comes next: the What's New
  modal must fire after the splash is *fully hidden*, or it pops over the
  splash mid-load (we shipped exactly this bug).
- Center multi-line lockups deliberately: shrink-wrapped spans and
  left-aligned text inside reserved-width boxes drift apart. Full-width
  centered text + centered title shares one axis.

---

## 8. Lists, settings pages, dialogs

- **Virtualize early**: windowed rendering (~30 rows) with spacer divs so
  scroll position survives rebuilds; measure row stride live from the DOM
  (fonts/scale change it).
- **Playing row stays marked** across reopen, group change, and refresh —
  re-derive focus/active from the playing item, never from stale indexes.
- **Settings pages**: left nav + content cards; every row remote-focusable;
  toggles apply + persist immediately (a visual-only toggle that never saves
  is a shipped bug we fixed — trigger the real save path from remote OK).
- **Confirm dialogs** need their own 2-item focus loop (Left/Right + OK +
  Back-to-cancel) that preempts all other layers while open.
- **Escape all injected strings** (`escapeHtml`) — playlist names/URLs come
  from the network.

---

## 9. Packaging + release (Tizen-specific)

- Launcher icon spec is **512×423 PNG** (Samsung's size, not square) —
  artwork composes centered on that canvas. The in-package `117×117` icon is
  emulator-only.
- **Verify what ships, not what you authored**: our packager once copied a
  128px test icon over the launcher — extract `icon.png` from the built
  `.wgt` and check dimensions after every packaging change.
- One signing key forever (`tizen/author-key.pem`, gitignored, backed up
  off-machine) — a new key makes the TV treat updates as a different app and
  wipes user settings.
- `config.xml` icon + version flow through the packager; in-app version is
  baked at build time from `package.json`.

---

## 10. Day-1 checklist for a new Tizen app

- [ ] `--tv-scale` system + all sizes in `calc()`
- [ ] No `gap`, `:has()`, `:scope` anywhere (`grep` before every merge)
- [ ] Global remote layer: arrows, OK, Back(27/10009), digits, registered
      Tizen special keys, preventDefault on all handled keys
- [ ] Visible focus ring + focus-order array + `scrollIntoView nearest`
- [ ] Back order: dialog → page → sidebar → confirm-exit (debounced)
- [ ] Tune veil paints before teardown; video hidden during overlays
- [ ] Empty/error/dead-air states all have brand + reason, never codes
- [ ] IME flow: first OK opens keyboard (Tizen only), second OK advances
- [ ] Inputs `width: 100%`, all injected strings escaped
- [ ] Splash staged with completion-chained follow-ups
- [ ] 512×423 launcher icon verified inside the built `.wgt`
- [ ] Test with remote only — unplug the mouse. If anything needs clicking,
      it is not done.
