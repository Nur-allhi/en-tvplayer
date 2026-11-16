import { describe, it, expect } from 'vitest';
import { parseLicenseKeyValue } from './drm.js';

const KID = 'abcdef1234567890';
const KEY = '1234567890abcdef';

describe('parseLicenseKeyValue — single KID:KEY', () => {
  it('parses a plain KID:KEY pair', () => {
    expect(parseLicenseKeyValue(`${KID}:${KEY}`)).toEqual({
      keyId: KID,
      key: KEY,
      clearKeys: { [KID]: KEY },
    });
  });

  it('normalises uppercase to lowercase', () => {
    expect(parseLicenseKeyValue('ABCDEF1234567890:1234567890ABCDEF')).toMatchObject({
      keyId: 'abcdef1234567890',
      key: '1234567890abcdef',
    });
  });

  it('strips dashes from a UUID-style key', () => {
    expect(
      parseLicenseKeyValue('abcdef12-3456-7890-abcd-ef1234567890:12345678-90ab-cdef-1234-567890abcdef'),
    ).toMatchObject({ keyId: 'abcdef1234567890abcdef1234567890' });
  });

  it('trims surrounding whitespace', () => {
    expect(parseLicenseKeyValue(`  ${KID}:${KEY}  `)).toMatchObject({ keyId: KID });
  });

  it('ignores a trailing suffix after the key', () => {
    expect(parseLicenseKeyValue(`${KID}:${KEY}:extra`)).toMatchObject({ keyId: KID, key: KEY });
  });
});

describe('parseLicenseKeyValue — unquoted dict', () => {
  it('parses {KID1:KEY1,KID2:KEY2}', () => {
    const r = parseLicenseKeyValue(`{${KID}:${KEY},0011223344556677:8899aabbccddeeff}`);
    expect(Object.keys(r.clearKeys)).toHaveLength(2);
    expect(r.clearKeys[KID]).toBe(KEY);
    expect(r.clearKeys['0011223344556677']).toBe('8899aabbccddeeff');
  });

  it('reports the first pair as keyId and key', () => {
    const r = parseLicenseKeyValue(`{${KID}:${KEY},0011223344556677:8899aabbccddeeff}`);
    expect(r.keyId).toBe(KID);
    expect(r.key).toBe(KEY);
  });

  it('tolerates quoted names and values inside a non-JSON dict', () => {
    const r = parseLicenseKeyValue(`{"${KID}":"${KEY}"}`);
    expect(r.clearKeys[KID]).toBe(KEY);
  });

  it('returns null when every pair in the dict is invalid', () => {
    expect(parseLicenseKeyValue(`{nothex:${KEY},${KID}:alsonothex}`)).toBeNull();
  });

  it('keeps the valid pairs and drops the invalid ones', () => {
    const r = parseLicenseKeyValue(`{nothex:${KEY},${KID}:${KEY}}`);
    expect(r.clearKeys).toEqual({ [KID]: KEY });
  });
});

describe('parseLicenseKeyValue — JSON dict', () => {
  it('parses a JSON object of KID to KEY', () => {
    const r = parseLicenseKeyValue(JSON.stringify({ [KID]: KEY }));
    expect(r.clearKeys).toEqual({ [KID]: KEY });
  });

  it('parses several JSON pairs', () => {
    const r = parseLicenseKeyValue(JSON.stringify({ [KID]: KEY, '0011223344556677': '8899aabbccddeeff' }));
    expect(Object.keys(r.clearKeys)).toHaveLength(2);
  });

  it('normalises case and dashes inside a JSON dict', () => {
    const r = parseLicenseKeyValue(
      JSON.stringify({ 'ABCDEF12-3456-7890-ABCD-EF1234567890': '12345678-90AB-CDEF-1234-567890ABCDEF' }),
    );
    expect(r.keyId).toBe('abcdef1234567890abcdef1234567890');
  });

  it('returns null when every JSON pair is invalid hex', () => {
    expect(parseLicenseKeyValue(JSON.stringify({ nope: 'nah' }))).toBeNull();
  });
});

describe('parseLicenseKeyValue — rejections', () => {
  it('returns null for a license-server URL', () => {
    expect(parseLicenseKeyValue('https://lic.example.com/key')).toBeNull();
    expect(parseLicenseKeyValue('http://lic.example.com/key')).toBeNull();
  });

  it('returns null for empty and whitespace-only input', () => {
    expect(parseLicenseKeyValue('')).toBeNull();
    expect(parseLicenseKeyValue('   ')).toBeNull();
    expect(parseLicenseKeyValue(null)).toBeNull();
    expect(parseLicenseKeyValue(undefined)).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parseLicenseKeyValue('nope')).toBeNull();
  });

  it('rejects a hex value shorter than 16 characters', () => {
    expect(parseLicenseKeyValue('abcdef:1234567890abcdef')).toBeNull();
  });

  it('rejects non-hex characters in the key', () => {
    expect(parseLicenseKeyValue('zzzzzzzzzzzzzzzz:1234567890abcdef')).toBeNull();
  });

  it('parses a missing closing brace, since the fallback strips it optionally', () => {
    // Characterisation, not a requirement: the non-JSON fallback strips a
    // leading { and an optional trailing }, so an unterminated block still
    // yields its inner pairs. Recorded so a future change is deliberate.
    expect(parseLicenseKeyValue(`{${KID}:${KEY}`)).toMatchObject({ keyId: KID, key: KEY });
  });
});
