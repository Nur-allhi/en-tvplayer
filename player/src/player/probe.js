// URL/proxy helpers and stream-format probe (T-123).
import { deps } from './deps.js';
import { state } from './state.js';
import { getSettings } from '../config.js';
import { withAuthQuery } from '../lib/url.js';
import { sniffMimeFromBytes } from '../lib/mime.js';

export function proxyBase() {
  try {
    return (getSettings().proxyUrl || 'https://localhost:5001').replace(/\/+$/, '');
  } catch {
    return 'https://localhost:5001';
  }
}

export function toProxied(url) {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  const base = proxyBase();
  if (url.startsWith(base + '/')) return url;
  return base + '/' + url;
}

export function isProxyEnabledFor(url) {
  try {
    return !!(getSettings().proxyChannels || {})[url];
  } catch {
    return false;
  }
}

export function notifyTuneAttempt() {
  try {
    if (state.tuneAttemptCallback) state.tuneAttemptCallback(state.tuneAttempt);
  } catch {}
}

export async function probeChannelFormat(channel) {
  if (!channel) return null;
  const controller = new AbortController();
  state.probeController = controller;
  try {
    const authedUrl = withAuthQuery(channel.url, channel.authQuery);
    const targetUrl = channel.useProxy ? toProxied(authedUrl) : authedUrl;
    if (!targetUrl) return null;

    const timer = setTimeout(() => controller.abort(), 8000);
    const headers = {};
    if (channel.userAgent) headers['User-Agent'] = channel.userAgent;
    if (channel.customHeaders) {
      for (const [k, v] of Object.entries(channel.customHeaders)) {
        const lower = k.toLowerCase();
        if (lower === 'user-agent') headers['User-Agent'] = v;
        else if (lower === 'referer') headers['Referer'] = v;
        else if (lower === 'origin') headers['Origin'] = v;
        else headers[k] = v;
      }
    }

    const resp = await fetch(targetUrl, { headers, signal: controller.signal });
    if (!resp.ok) {
      clearTimeout(timer);
      return null;
    }
    if (!resp.body || typeof resp.body.getReader !== 'function') {
      clearTimeout(timer);
      return null;
    }

    const reader = resp.body.getReader();
    let bytes = new Uint8Array(0);
    const MAX = 65536;
    while (bytes.length < MAX) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const next = new Uint8Array(bytes.length + value.length);
        next.set(bytes);
        next.set(value, bytes.length);
        bytes = next;
      }
    }
    try {
      await reader.cancel();
    } catch {}
    clearTimeout(timer);
    if (state.probeController === controller) state.probeController = null;
    return sniffMimeFromBytes(bytes);
  } catch (e) {
    if (state.probeController === controller) state.probeController = null;
    deps.logEvent('WARN', 'Format probe failed: ' + (e && e.message ? e.message : e));
    return null;
  }
}

// This slice wires its own deps slots. The hub only assembles the API.
Object.assign(deps, {
  toProxied,
  isProxyEnabledFor,
  notifyTuneAttempt,
  probeChannelFormat,
});
