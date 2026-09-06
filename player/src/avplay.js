// Native playback via Samsung AVPlay (webapis.avplay).
// Used ONLY as a fallback for streams the browser decoder cannot render
// (e.g. interlaced MBAFF H264 — buffering completes, zero frames painted,
// no Shaka error). The native pipeline handles those fine (same as ibocast).
// Absent outside Tizen (desktop dev) — every function guards and no-ops.

let avObject = null;
let bufferingCallback = null;
let errorCallback = null;
let readyResolve = null;
let readyTimer = null;
let firstFrameSeen = false;
// BUG-020 regression guard: never touch the native instance unless we
// actually opened it — a stray stop()/close() on every channel load hung
// all playback on some firmwares.
let active = false;

export function isAvailable() {
  try {
    return typeof window !== 'undefined' && !!window.webapis && !!window.webapis.avplay;
  } catch {
    return false;
  }
}

function el() {
  if (!avObject) avObject = document.getElementById('avplayer');
  return avObject;
}

function clearReadyTimer() {
  if (readyTimer) {
    clearTimeout(readyTimer);
    readyTimer = null;
  }
}

function resolveReady(ok) {
  clearReadyTimer();
  const cb = readyResolve;
  readyResolve = null;
  if (cb) cb(ok);
}

export function onBuffering(callback) {
  bufferingCallback = callback;
}

export function onError(callback) {
  errorCallback = callback;
}

// Opens url natively. Resolves true once the first frame plays, false on
// error/timeout. Rejects never — always resolves.
export function play(url, { userAgent, referer, timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    if (!isAvailable()) {
      resolve(false);
      return;
    }
    stop();
    const obj = el();
    if (!obj) {
      resolve(false);
      return;
    }
    obj.classList.remove('hidden');
    firstFrameSeen = false;
    readyResolve = resolve;
    try {
      const avplay = window.webapis.avplay;
      try {
        if (userAgent) avplay.setStreamingProperty('USER_AGENT', userAgent);
        if (referer) avplay.setStreamingProperty('REFERRER', referer);
      } catch {}
      avplay.setListener({
        onbufferingstart: () => {
          if (bufferingCallback) bufferingCallback(true);
        },
        onbufferingprogress: (percent) => {
          if (bufferingCallback) bufferingCallback(true, percent);
        },
        onbufferingcomplete: () => {
          if (bufferingCallback) bufferingCallback(false);
        },
        oncurrentplaytime: () => {
          if (!firstFrameSeen) {
            firstFrameSeen = true;
            if (bufferingCallback) bufferingCallback(false);
            resolveReady(true);
          }
        },
        onerror: (type) => {
          if (errorCallback) errorCallback(type);
          resolveReady(false);
        },
        onstreamcompleted: () => {
          resolveReady(true);
        },
      });
      avplay.open(url);
      active = true;
      avplay.setDisplayRect(0, 0, 1920, 1080);
      avplay.prepareAsync(() => {
        try {
          avplay.play();
        } catch {
          resolveReady(false);
        }
      }, () => resolveReady(false));
      readyTimer = setTimeout(() => resolveReady(firstFrameSeen), timeoutMs);
    } catch {
      resolveReady(false);
    }
  });
}

export function pause() {
  try {
    if (active && isAvailable()) window.webapis.avplay.pause();
  } catch {}
}

export function resume() {
  try {
    if (active && isAvailable()) window.webapis.avplay.play();
  } catch {}
}

export function stop() {
  clearReadyTimer();
  readyResolve = null;
  firstFrameSeen = false;
  if (active) {
    active = false;
    try {
      if (isAvailable()) {
        window.webapis.avplay.stop();
        window.webapis.avplay.close();
      }
    } catch {}
  }
  const obj = avObject || document.getElementById('avplayer');
  if (obj) obj.classList.add('hidden');
}
