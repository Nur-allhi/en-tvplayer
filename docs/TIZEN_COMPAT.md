# TIZEN COMPATIBILITY MATRIX — EN TV Player

> **Status:** authoritative reference for platform support.
> **Measured:** 2026-11-15 against `player/dist/assets/index.*.js` (the shipped bundle).
> **Rule:** every claim here is backed by a test you can re-run — see §5.

---

## 1. Platform baseline

Samsung Tizen TV apps run in a WebView whose engine varies by TV model and
firmware. The only reliable identifier at runtime is `window.tizen.webAPIVersion`.

| Tizen | Web Engine | Chromium (approx) | Year | Shipped in repo |
|-------|-----------|-------------------|------|-----------------|
| 4.0   | WebKit (legacy) | 47 | 2015 | ❌ not supported |
| 5.0   | Chromium 56 | 56 | 2016 | ✅ current minimum |
| 6.0   | Chromium 69 | 69 | 2018 | ✅ |
| 7.0   | Chromium 79 | 79 | 2020 | ✅ |
| 8.0+  | Chromium 87+ | 87+ | 2020+ | ✅ |

> **Correction to earlier drafts:** Tizen 4 *does* run this app's JavaScript
> syntax. The build emits a single **IIFE** bundle (`format: 'iife'`,
> `target: 'es2015'`) and `player/vite.config.js` strips `type="module"` from
> the built HTML. There is no ES-module dependency at runtime, so "Tizen 4 has
> no ES modules" is **not** the blocker. The blocker is *runtime APIs* (§3).

---

## 2. Why the bundle is safe on old engines

Verified by parsing the **built** bundle with acorn at fixed language levels:

```
ecmaVersion 5    -> FAIL  (Assigning to rvalue)
ecmaVersion 2015 -> OK    <-- the shipped level
ecmaVersion 2020 -> OK
```

AST census of the shipped bundle:

| Construct | Count | Safe on Chromium 56? |
|-----------|-------|----------------------|
| `AwaitExpression` (native async/await) | 0 | ✅ downleveled by esbuild |
| `ClassDeclaration` / `ClassExpression` | 0 | ✅ |
| `ChainExpression` (real optional chaining `?.`) | 0 | ✅ downleveled by esbuild |
| `ConditionalExpression` (ternary `? :`) | 2372 | ✅ (the `?.` strings in the bundle are ternary `? .1`, **not** optional chaining) |
| `ArrowFunctionExpression` | 195 | ✅ (Chromium 45+) |
| `TemplateLiteral` | 31 | ✅ (Chromium 41+) |
| `SpreadElement` | 2 | ✅ (Chromium 46+) |

**Takeaway:** the *syntax* floor is Chromium 45/47-era. Tizen 4 is not blocked
by language level. It is blocked by the runtime APIs below.

---

## 3. Runtime API gaps (the real gate)

Scanned against the shipped bundle. "Blocks" lists the Tizen versions that
**cannot** run the API.

| API | Chrome ≥ | Blocks | Origin | Severity |
|-----|----------|--------|--------|----------|
| `Object.entries` / `Object.values` | 54 | 4.0 | **ours** (player.js, utils.js) | 🔴 high |
| `URLSearchParams` | 49 | 4.0 | **ours** (xtream.js, update.js) | 🔴 high |
| `Proxy` | 49 | 4.0 | Shaka | 🔴 high |
| `IntersectionObserver` | 51 | 4.0 | Shaka | 🟡 medium |
| `AbortController` | 66 | 4.0, 5.0 | **ours** (player.js, update.js) | 🟡 medium |
| `String.prototype.trimStart` | 66 | 4.0, 5.0 | **ours** (player.js) | 🟡 medium |
| `ResizeObserver` | 64 | 4.0, 5.0 | Shaka | 🟡 medium |
| `navigator.mediaCapabilities` | 66 | 4.0, 5.0 | Shaka — **already guarded** (`!!navigator.mediaCapabilities`) | 🟢 low |
| `globalThis` | 71 | 4.0, 5.0, 6.0 | Shaka — **already guarded** (`globalThis && globalThis, … typeof window`) | 🟢 low |
| `requestVideoFrameCallback` | 83 | 4.0–7.0 | **ours** — **already guarded** (`typeof … === 'function'`, `player.js:1316`) | 🟢 low |
| `Promise` | 32 | — | Shaka's `isBrowserSupported()` requires `window.Promise` | ✅ ok |
| `fetch` | 42 | — | ours | ✅ ok |
| `URL` | 32 | — | ours | ✅ ok |
| `TextDecoder` | 38 | — | ours (format probe) | ✅ ok |
| `Map` / `Set` / `WeakMap` / `Symbol` | 36–38 | — | both | ✅ ok |

### 3.1 What this means per platform

**Tizen 5.0 (Chromium 56)** — reachable with a small, low-risk shim:
`AbortController` + `trimStart` + `ResizeObserver`. All three are polyfillable
in a few lines, and two of them (`mediaCapabilities`, `globalThis`) are already
guarded upstream in Shaka.

**Tizen 4.0 (Chromium 47)** — **requires Shaka to work without `Proxy`**
(Chrome 49). Shaka Player 5.x uses `Proxy` internally; there is no supported
configuration that removes it, and `Proxy` cannot be meaningfully polyfilled
(semantics are not specifiable). `Object.entries` / `URLSearchParams` in our own
code are polyfillable; `Proxy` is not.

> **Verdict: Tizen 4.0 is not achievable with Shaka Player 5.x.**
> The only path to Tizen 4 would be dropping the Shaka engine entirely and
> using only the native `webapis.avplay` pipeline — which cannot play
> ClearKey/PlayReady DRM, i.e. it would drop the app's headline feature.
>
> **Recommendation:** declare **Tizen 5.0 the supported floor**, ship a
> Tizen-5 compatibility shim (cheap, ~60 LOC), and treat Tizen 4 as
> out of scope. This is stated plainly in the README so users are not misled.
> Re-evaluate only if Shaka publishes a non-`Proxy` build.

---

## 4. Capability detection (shipped in v4.0.0)

Runtime probe, single source of truth for the whole app.

**It is two files, not one.** The plan originally put the probe in
`lib/capabilities.js`, but `lib/` is DOM-free by rule and
`scripts/validate-modularity.mjs` matches `/\bwindow\b/` — which
`typeof window !== 'undefined'` also trips. So the pure decisions live in
`lib/` and the one function that reads platform globals lives beside
`avplay.js`:

```js
// player/src/capabilities.js — the ONLY place that reads window/navigator
import { parseWebApiVersion, selectEngine } from './lib/capabilities.js';

export function detectCapabilities(win) {
  const w = win === undefined ? (typeof window !== 'undefined' ? window : null) : win;
  // (abridged — every read is wrapped in try/catch)
  return {
    isTizen: !!(w && w.tizen),
    hasTvInputDevice: !!(w && w.tizen && w.tizen.tvinputdevice),
    hasApplicationControl: !!(w && w.tizen && w.tizen.application),
    webApiVersion: parseWebApiVersion(w && w.tizen && w.tizen.webAPIVersion),
    hasAbortController: typeof w.AbortController !== 'undefined',
    hasTrimStart: typeof ''.trimStart === 'function',
    hasResizeObserver: typeof w.ResizeObserver !== 'undefined',
    hasRequestVideoFrameCallback: /* HTMLVideoElement.prototype check */,
    hasMediaCapabilities: !!(w.navigator && w.navigator.mediaCapabilities),
    hasShaka: true, // bundled as a module — see note below
    hasAvplay: !!(w.webapis && w.webapis.avplay),
  };
}

export function capabilities() {}   // cached probe
export function currentEngine() {}  // selectEngine(capabilities())
```

> **`hasShaka` is deliberately not probed.** The app imports Shaka as an ES
> module (`import shaka from 'shaka-player'`) and never assigns `window.shaka`,
> so probing the global reported `false` on every TV the app actually ships to
> — which made `selectEngine()` claim a working Shaka TV was native-only. If
> this code runs, Shaka is there. Do not "restore" the global check.

```js
// player/src/lib/capabilities.js — pure, DOM-free, unit-tested
export const MIN_WEB_API_VERSION = 5.0;
export function parseWebApiVersion(raw) {}
export function meetsMinimumPlatform(caps) {}
export function selectEngine(caps) {}        // 'shaka' | 'native' | 'none'
export function engineLabel(engine) {}
export function missingApis(caps) {}
export function canObserveVideoFrames(caps) {}
export function hasTvKeyInput(caps) {}
export function platformName(caps) {}
```

Taking `win` as a parameter is what makes the probe testable in the project's
node test env — no jsdom, no globals to stub.

Consumers (all shipped as of T-115):

- `avplay.js` — `isAvailable()` is now `capabilities().hasAvplay`; the module
  keeps only its own runtime state (whether it opened the native instance)
- `main.js` — `registerTizenKeys()` and app exit read `hasTvKeyInput` /
  `hasApplicationControl`
- `remote.js` — the search-field Backspace/Enter handling reads `hasTvKeyInput`
- `settings.js` — the IME re-focus behaviour reads `hasTvKeyInput`
- `update.js` — the opt-in usage ping reports `platformName(caps)`

> **`window.tizen` and `window.webapis` are read in exactly one file.**
> `capabilities.js` is the only place that inspects them; everything else asks
> the probe. Remaining `window.tizen.*` occurrences are *API calls* after a
> guard (e.g. `registerKey`), not detection — leave those alone.
>
> **`player.js`'s `useAvplay` is runtime state, not a capability.** It records
> that a *specific channel* fell back to native. `selectEngine()` answers what
> the *platform* can do. Do not collapse the two.

---

## 5. How to re-verify this document

```bash
# 1. Build the real artifact
npm run build

# 2. Confirm the language level of the shipped bundle
node -e "
const acorn=require('acorn'),fs=require('fs');
const f=fs.readdirSync('player/dist/assets').find(x=>x.endsWith('.js'));
const src=fs.readFileSync('player/dist/assets/'+f,'utf8');
for(const v of [5,2015,2020]){
  try{acorn.parse(src,{ecmaVersion:v});console.log(v,'OK');}
  catch(e){console.log(v,'FAIL');}
}"

# 3. Re-run the runtime API scan
node -e "
const fs=require('fs');
const f=fs.readdirSync('player/dist/assets').find(x=>x.endsWith('.js'));
const src=fs.readFileSync('player/dist/assets/'+f,'utf8');
for(const a of ['Object.entries','URLSearchParams','AbortController','trimStart',
                'ResizeObserver','IntersectionObserver','requestVideoFrameCallback',
                'globalThis','mediaCapabilities','Proxy']){
  if(src.includes(a)) console.log('present:',a);
}"
```

Any API added to the bundle must be added to the §3 table **in the same PR**.

---

## 6. Change log of this matrix

| Date | Change |
|------|--------|
| 2026-11-15 | Initial matrix; measured against v3.2.0 bundle. Tizen 4 ruled out (Shaka `Proxy` dependency); Tizen 5.0 declared the floor. |
