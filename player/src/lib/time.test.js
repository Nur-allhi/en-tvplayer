import { describe, it, expect } from 'vitest';
import { timeAgo, formatDate } from './time.js';

const LOCALE = 'en-US';
const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);

// Build an ISO string that is `seconds` in the past relative to NOW.
const ago = (seconds) => new Date(NOW - seconds * 1000).toISOString();

describe('timeAgo — buckets', () => {
  it('says Just now under 10 seconds', () => {
    expect(timeAgo(ago(0), NOW, LOCALE)).toBe('Just now');
    expect(timeAgo(ago(9), NOW, LOCALE)).toBe('Just now');
  });

  it('switches to seconds at 10', () => {
    expect(timeAgo(ago(10), NOW, LOCALE)).toBe('10s ago');
    expect(timeAgo(ago(59), NOW, LOCALE)).toBe('59s ago');
  });

  it('switches to minutes at 60', () => {
    expect(timeAgo(ago(60), NOW, LOCALE)).toBe('1m ago');
    expect(timeAgo(ago(3599), NOW, LOCALE)).toBe('59m ago');
  });

  it('switches to hours at 3600', () => {
    expect(timeAgo(ago(3600), NOW, LOCALE)).toBe('1h ago');
    expect(timeAgo(ago(86399), NOW, LOCALE)).toBe('23h ago');
  });

  it('falls back to an absolute date at 24 hours', () => {
    const iso = ago(86400);
    expect(timeAgo(iso, NOW, LOCALE)).toBe(new Date(iso).toLocaleDateString(LOCALE));
  });

  it('truncates rather than rounds', () => {
    expect(timeAgo(ago(119), NOW, LOCALE)).toBe('1m ago');
    expect(timeAgo(ago(7199), NOW, LOCALE)).toBe('1h ago');
  });
});

describe('timeAgo — edge cases', () => {
  it('says Just now for a future timestamp', () => {
    expect(timeAgo(new Date(NOW + 60000).toISOString(), NOW, LOCALE)).toBe('Just now');
  });

  it('returns Never for missing or invalid input', () => {
    expect(timeAgo(null, NOW, LOCALE)).toBe('Never');
    expect(timeAgo(undefined, NOW, LOCALE)).toBe('Never');
    expect(timeAgo('', NOW, LOCALE)).toBe('Never');
    expect(timeAgo('not-a-date', NOW, LOCALE)).toBe('Never');
  });

  it('defaults the reference to now when omitted', () => {
    expect(timeAgo(new Date().toISOString(), undefined, LOCALE)).toBe('Just now');
  });
});

describe('formatDate', () => {
  it('formats a valid date in the given locale', () => {
    const iso = '2026-11-16T12:00:00.000Z';
    expect(formatDate(iso, LOCALE)).toBe(new Date(iso).toLocaleDateString(LOCALE));
  });

  it('returns Never for missing or invalid input', () => {
    expect(formatDate(null, LOCALE)).toBe('Never');
    expect(formatDate('', LOCALE)).toBe('Never');
    expect(formatDate('not-a-date', LOCALE)).toBe('Never');
  });

  it('is locale-stable when the locale is pinned', () => {
    const iso = '2026-11-16T12:00:00.000Z';
    expect(formatDate(iso, LOCALE)).toBe(formatDate(iso, LOCALE));
  });
});
