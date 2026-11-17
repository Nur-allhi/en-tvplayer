import { describe, it, expect } from 'vitest';
import { createLogRing, redactLine } from './ring-buffer.js';

describe('redactLine', () => {
  it('strips the query and fragment from an embedded stream URL', () => {
    expect(redactLine('load https://cdn.example.com/live.m3u8?token=secret#frag ok')).toBe(
      'load https://cdn.example.com/live.m3u8 ok',
    );
  });

  it('redacts a standalone URL through redactUrl', () => {
    expect(redactLine('https://cdn.example.com/a.ts?k=1')).toBe('https://cdn.example.com/a.ts');
  });

  it('leaves non-network URLs untouched (data: license keys)', () => {
    expect(redactLine('data:application/json;base64,abc?x=1')).toBe('data:application/json;base64,abc?x=1');
  });

  it('redacts email-like PII', () => {
    expect(redactLine('contact joe.user@example.com now')).toBe('contact [email] now');
  });

  it('stringifies non-string messages', () => {
    expect(redactLine(42)).toBe('42');
    expect(redactLine(undefined)).toBe('undefined');
  });
});

describe('createLogRing', () => {
  it('starts empty', () => {
    expect(createLogRing().tail()).toEqual([]);
  });

  it('stores level-prefixed lines on push', () => {
    const ring = createLogRing();
    ring.push('info', 'tuned');
    expect(ring.tail()).toEqual(['[info] tuned']);
  });

  it('redacts tokens and PII on push', () => {
    const ring = createLogRing();
    ring.push('error', 'fail https://cdn.example.com/a.ts?token=s3cr3t for joe@example.com');
    expect(ring.tail()).toEqual(['[error] fail https://cdn.example.com/a.ts for [email]']);
  });

  it('caps at 200 entries by default and keeps the newest', () => {
    const ring = createLogRing();
    for (let i = 0; i < 205; i++) ring.push('info', 'line' + i);
    expect(ring.size).toBe(200);
    expect(ring.tail(2)).toEqual(['[info] line203', '[info] line204']);
  });

  it('respects a custom limit', () => {
    const ring = createLogRing(3);
    for (let i = 0; i < 5; i++) ring.push('info', 'x' + i);
    expect(ring.tail()).toEqual(['[info] x2', '[info] x3', '[info] x4']);
  });

  it('falls back to 200 for an invalid limit', () => {
    const ring = createLogRing(0);
    for (let i = 0; i < 201; i++) ring.push('info', 'y');
    expect(ring.size).toBe(200);
  });

  it('tail(n) returns at most the last n lines', () => {
    const ring = createLogRing();
    ring.push('a', '1');
    ring.push('b', '2');
    expect(ring.tail(1)).toEqual(['[b] 2']);
  });

  it('toText joins the tail with newlines', () => {
    const ring = createLogRing();
    ring.push('a', '1');
    ring.push('b', '2');
    expect(ring.toText()).toBe('[a] 1\n[b] 2');
  });
});
