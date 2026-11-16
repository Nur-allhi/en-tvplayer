// Edge-auth tokens (Akamai __hdnea__/hdnea/hdntl style) are often delivered
// as a `Cookie` header, which browsers refuse to send — Cookie is a
// forbidden header, fetch/XHR silently drop it. Native players (OTT
// Navigator, NS Player) send it fine, so those channels play there but get
// 403 here. Promote known token cookies to URL query params (browser-legal);
// this CDN family already accepts the same tokens as `?__hdnea__=…` on URLs.
const AUTH_COOKIE_NAMES = ['__hdnea__', 'hdnea', 'hdntl', 'hdnts'];

export function extractAuthQuery(customHeaders) {
  if (!customHeaders) return null;
  let cookie = null;
  for (const [k, v] of Object.entries(customHeaders)) {
    if (String(k).toLowerCase() === 'cookie' && v) {
      cookie = String(v);
      break;
    }
  }
  if (!cookie) return null;
  const out = [];
  for (const part of cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!name || !value) continue;
    if (
      AUTH_COOKIE_NAMES.includes(name.toLowerCase()) &&
      !out.some((p) => p.toLowerCase().startsWith(name.toLowerCase() + '='))
    ) {
      out.push(name + '=' + value);
    }
  }
  return out.length > 0 ? out.join('&') : null;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Append auth token params to a URL unless already present. String-based so
// raw token chars (~, /, *) match the provider's own URL style.
// HTTP(S) only: Shaka also fetches non-network URIs through the same
// pipeline (e.g. ClearKey's `data:` license URI holding the inline keys) —
// appending a query there corrupts the payload and breaks decryption (6007).
export function withAuthQuery(uri, authQuery) {
  if (!uri || !authQuery) return uri;
  if (!/^https?:\/\//i.test(uri)) return uri;
  try {
    const hashIdx = uri.indexOf('#');
    const hash = hashIdx >= 0 ? uri.slice(hashIdx) : '';
    let base = hashIdx >= 0 ? uri.slice(0, hashIdx) : uri;
    for (const pair of String(authQuery).split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const name = pair.slice(0, eq);
      if (!name) continue;
      const present = new RegExp('[?&]' + escapeRegExp(name) + '=').test(base);
      if (!present) {
        base += (base.includes('?') ? '&' : '?') + pair;
      }
    }
    return base + hash;
  } catch {
    return uri;
  }
}

// Privacy: stream URLs often carry `?token=…` query auth. Users paste
// inspector logs publicly on GitHub — never log the query string, only
// host + path. HTTP(S) only; other schemes (e.g. data: license URIs) pass
// through untouched.
export function redactUrl(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return url;
  const idx = url.search(/[?#]/);
  return idx === -1 ? url : url.slice(0, idx);
}
