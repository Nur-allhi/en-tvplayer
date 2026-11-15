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

Runtime probe, single source of truth for the whole app:

```js
// player/src/lib/capabilities.js
export function detectCapabilities() {
  const version = parseFloat(
    (typeof window !== 'undefined' && window.tizen && window.tizen.webAPIVersion) || '5.0',
  );
  return {
    webApiVersion: version,
    // Chromium-derived API availability
    hasAbortController: typeof AbortController !== 'undefined',
    hasTrimStart: typeof ''.trimStart === 'function',
    hasResizeObserver: typeof ResizeObserver !== 'undefined',
    hasRequestVideoFrameCallback:
      typeof HTMLVideoElement !== 'undefined' &&
      typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function',
    hasMediaCapabilities: !!(typeof navigator !== 'undefined' && navigator.mediaCapabilities),
    // engine
    hasShaka: typeof window !== 'undefined' && !!(window.shaka || window.ShakaPlayer),
    hasAvplay: typeof window !== 'undefined' && !!(window.webapis && window.webapis.avplay),
    isTizen: typeof window !== 'undefined' && !!window.tizen,
  };
}
```

Consumers:

- `player/recovery.js` — native fallback when `hasAvplay && !hasShaka`
- `player/black-watchdog.js` — `getVideoPlaybackQuality()` path when
  `!hasRequestVideoFrameCallback`
- `app/about.js` — display "Engine: Shaka / Native / Browser" + TV API version

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
