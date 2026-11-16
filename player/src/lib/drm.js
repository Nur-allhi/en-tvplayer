function normalizeHex(s) {
  return String(s || '')
    .replace(/-/g, '')
    .toLowerCase();
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
        const v = pair
          .slice(colonIdx + 1)
          .trim()
          .replace(/^"|"$/g, '');
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
