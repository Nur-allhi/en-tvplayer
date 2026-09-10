export function processStreamUrl(rawUrl) {
  const pipeIdx = rawUrl.indexOf('|');
  if (pipeIdx === -1) return { url: rawUrl, extraHeaders: null };

  const baseUrl = rawUrl.slice(0, pipeIdx);
  const suffix = rawUrl.slice(pipeIdx + 1);
  const extraHeaders = {};
  const extraParams = [];

  for (const part of suffix.split('&')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx);
    const value = part.slice(eqIdx + 1);
    if (key.startsWith('edge-')) {
      extraParams.push(key + '=' + value);
    } else {
      extraHeaders[key.toLowerCase()] = value;
    }
  }

  let finalUrl = baseUrl;
  if (extraParams.length > 0) {
    finalUrl += (baseUrl.includes('?') ? '&' : '?') + extraParams.join('&');
  }

  return { url: finalUrl, extraHeaders: Object.keys(extraHeaders).length > 0 ? extraHeaders : null };
}

function findNameSeparator(line) {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      return i;
    }
  }
  return -1;
}

// T-033: parse Kodi `stream_headers` value (`Key=Val&...`, values may be
// URL-encoded). Returns { headers, userAgent }.
export function parseStreamHeaders(raw) {
  const headers = {};
  let userAgent = null;
  if (!raw) return { headers, userAgent };
  for (const part of String(raw).split('&')) {
    if (!part) continue;
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    let value = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      value = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {}
    headers[key] = value;
    if (key.toLowerCase() === 'user-agent' && !userAgent) userAgent = value;
  }
  return { headers, userAgent };
}

function normalizeHex(s) {
  return String(s || '').replace(/-/g, '').toLowerCase();
}

function isHex(s) {
  return /^[a-f0-9]+$/.test(s) && s.length >= 16;
}

// T-034: parse Kodi `license_key` ClearKey value. Supports single `KID:KEY`,
// unquoted dict `{KID1:KEY1,KID2:KEY2}` and JSON dict `{"KID1":"KEY1",...}`.
// Returns { keyId, key, clearKeys } or null.
export function parseLicenseKeyValue(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  if (!value || value.startsWith('http')) return null; // license-server URL form — out of scope
  if (value.startsWith('{')) {
    let obj = null;
    try {
      obj = JSON.parse(value);
    } catch {
      obj = null;
      const inner = value.replace(/^\{/, '').replace(/\}$/, '');
      obj = {};
      for (const pair of inner.split(',')) {
        if (!pair.trim()) continue;
        const colonIdx = pair.indexOf(':');
        if (colonIdx === -1) continue;
        const k = pair.slice(0, colonIdx).trim().replace(/^"|"$/g, '');
        const v = pair.slice(colonIdx + 1).trim().replace(/^"|"$/g, '');
        if (k && v) obj[k] = v;
      }
    }
    if (obj && typeof obj === 'object') {
      const clearKeys = {};
      for (const [k, v] of Object.entries(obj)) {
        const kid = normalizeHex(k.trim().replace(/^"|"$/g, ''));
        const key = normalizeHex(String(v).trim().replace(/^"|"$/g, ''));
        if (isHex(kid) && isHex(key)) clearKeys[kid] = key;
      }
      const kids = Object.keys(clearKeys);
      if (kids.length > 0) {
        return { keyId: kids[0], key: clearKeys[kids[0]], clearKeys };
      }
    }
    return null;
  }
  const single = value.match(/([a-fA-F0-9-]{16,}):([a-fA-F0-9-]{16,})/);
  if (single) {
    const kid = normalizeHex(single[1]);
    const key = normalizeHex(single[2]);
    if (isHex(kid) && isHex(key)) {
      return { keyId: kid, key, clearKeys: { [kid]: key } };
    }
  }
  return null;
}

export function parseM3u(text) {
  const lines = text.split('\n');
  const result = [];
  let index = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      const sepIdx = findNameSeparator(line);
      const name = sepIdx >= 0 ? line.slice(sepIdx + 1).trim() : 'Channel ' + (index + 1);
      const attrPart = sepIdx >= 0 ? line.slice(0, sepIdx) : line;
      const groupMatch = attrPart.match(/\bgroup-title="([^"]*)"/);
      const chnoMatch = attrPart.match(/\btvg-chno="([^"]*)"/) || attrPart.match(/\bchannel-number="([^"]*)"/);
      let drm = null;
      let userAgent = null;
      let customHeaders = null;
      let urlIdx = i + 1;
      while (urlIdx < lines.length) {
        const next = lines[urlIdx].trim();
        if (next.startsWith('#KODIPROP:')) {
          const lower = next.toLowerCase();
          if (lower.includes('stream_headers=')) {
            const raw = next.slice(next.indexOf('stream_headers=') + 'stream_headers='.length);
            const { headers, userAgent: ua } = parseStreamHeaders(raw);
            if (Object.keys(headers).length > 0) {
              customHeaders = { ...(customHeaders || {}), ...headers };
            }
            if (ua && !userAgent) userAgent = ua;
          } else if (lower.includes('license_key=')) {
            const raw = next.slice(next.indexOf('license_key=') + 'license_key='.length);
            const parsed = parseLicenseKeyValue(raw);
            if (parsed) drm = parsed;
          }
          urlIdx++;
        } else if (next.startsWith('#EXTSYS')) {
          urlIdx++;
        } else if (next.startsWith('#EXTVLCOPT:')) {
          const uaMatch = next.match(/http-user-agent=(.+)/);
          if (uaMatch) {
            userAgent = uaMatch[1].trim();
          }
          urlIdx++;
        } else if (next.startsWith('#EXTHTTP:')) {
          try {
            const json = JSON.parse(next.slice('#EXTHTTP:'.length));
            if (json && typeof json === 'object') {
              customHeaders = {};
              for (const [k, v] of Object.entries(json)) {
                customHeaders[k] = String(v);
              }
            }
          } catch (e) {}
          urlIdx++;
        } else {
          break;
        }
      }
      const rawUrl = lines[urlIdx] ? lines[urlIdx].trim() : '';
      if (rawUrl && !rawUrl.startsWith('#')) {
        if (!drm) {
          const urlDrm = rawUrl.match(/[?&]drmLicense=([a-fA-F0-9-]+):([a-fA-F0-9-]+)/);
          if (urlDrm) {
            const parsed = parseLicenseKeyValue(urlDrm[1] + ':' + urlDrm[2]);
            if (parsed) drm = parsed;
          }
        }
        const { url, extraHeaders } = processStreamUrl(rawUrl);
        if (extraHeaders) {
          customHeaders = { ...(customHeaders || {}), ...extraHeaders };
        }
        const parsedChno = chnoMatch ? parseInt(chnoMatch[1], 10) : NaN;
        const ch = { name, url, channelNumber: !isNaN(parsedChno) && parsedChno > 0 ? parsedChno : index + 1, drm, userAgent, customHeaders, group: groupMatch ? groupMatch[1] : null };
        result.push(ch);
        index++;
        i = urlIdx;
      }
    }
  }
  return result;
}

function fetchWithTimeout(url, ms) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out. Please check your internet connection.')), ms)),
  ]);
}

export async function fetchPlaylist(url) {
  let resp;
  try {
    resp = await fetchWithTimeout(url, 10000);
  } catch (e) {
    throw new Error('Could not load playlist. Please check the URL and your internet connection.');
  }
  if (!resp.ok) throw new Error('Server returned error ' + resp.status);
  const contentType = resp.headers.get('content-type') || '';
  const text = await resp.text();
  if (contentType.includes('json') || text.trim().startsWith('[') || text.trim().startsWith('{')) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.channels)) {
      return data.channels;
    }
    throw new Error('The playlist file has an unexpected format.');
  }
  if (text.includes('#EXTM3U')) {
    return parseM3u(text);
  }    throw new Error('This playlist format is not supported. Please use an M3U or JSON playlist.');
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
