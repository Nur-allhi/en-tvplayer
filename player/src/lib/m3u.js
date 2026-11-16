import { extractAuthQuery } from './url.js';
import { parseLicenseKeyValue } from './drm.js';

// Kodi pipe suffix, literal '|' or URL-encoded '%7C' (playlists that
// escaped it, e.g. `cenc.mpd?%7CdrmScheme=clearkey&drmLicense=KID:KEY`).
// The suffix is player syntax, never part of the HTTP request URL.
export function processStreamUrl(rawUrl) {
  let pipeIdx = rawUrl.indexOf('|');
  const encIdx = rawUrl.toLowerCase().indexOf('%7c');
  let delimLen = 1;
  if (encIdx !== -1 && (pipeIdx === -1 || encIdx < pipeIdx)) {
    pipeIdx = encIdx;
    delimLen = 3;
  }
  if (pipeIdx === -1) return { url: rawUrl, extraHeaders: null };

  let baseUrl = rawUrl.slice(0, pipeIdx);
  if (baseUrl.endsWith('?')) baseUrl = baseUrl.slice(0, -1);
  const suffix = rawUrl.slice(pipeIdx + delimLen);
  const extraHeaders = {};
  const extraParams = [];

  for (const part of suffix.split('&')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx);
    const value = part.slice(eqIdx + 1);
    if (/^drmscheme$/i.test(key) || /^drmlicense$/i.test(key)) continue; // DRM directives, not HTTP headers
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
          } catch {}
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
        const ch = {
          name,
          url,
          channelNumber: !isNaN(parsedChno) && parsedChno > 0 ? parsedChno : index + 1,
          drm,
          userAgent,
          customHeaders,
          authQuery: extractAuthQuery(customHeaders),
          group: groupMatch ? groupMatch[1] : null,
        };
        result.push(ch);
        index++;
        i = urlIdx;
      }
    }
  }
  return result;
}
