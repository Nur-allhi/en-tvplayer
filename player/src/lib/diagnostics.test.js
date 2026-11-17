import { describe, it, expect } from 'vitest';
import { formatDiagnostics } from './diagnostics.js';

describe('formatDiagnostics', () => {
  it('includes the app version and TV model', () => {
    const text = formatDiagnostics({ version: '3.2.0', tvModel: 'UE55TU8000', logTail: [] });
    expect(text).toContain('Version: 3.2.0');
    expect(text).toContain('TV model: UE55TU8000');
  });

  it('includes the log tail in chronological order', () => {
    const text = formatDiagnostics({ version: '1', tvModel: 'TV', logTail: ['[info] old', '[warn] new'] });
    expect(text.indexOf('[info] old')).toBeLessThan(text.indexOf('[warn] new'));
  });

  it('redacts stream tokens from the tail', () => {
    const text = formatDiagnostics({
      version: '1',
      tvModel: 'TV',
      logTail: ['load https://cdn.example.com/a.m3u8?token=abc123'],
    });
    expect(text).toContain('https://cdn.example.com/a.m3u8');
    expect(text).not.toContain('token=abc123');
  });

  it('redacts email PII from the tail', () => {
    const text = formatDiagnostics({ version: '1', tvModel: 'TV', logTail: ['user joe@example.com'] });
    expect(text).not.toContain('joe@example.com');
    expect(text).toContain('[email]');
  });

  it('caps the tail at 40 lines', () => {
    const tail = Array.from({ length: 60 }, (_, i) => 'line' + i);
    const text = formatDiagnostics({ version: '1', tvModel: 'TV', logTail: tail });
    expect(text).not.toContain('line0\n');
    expect(text).toContain('line59');
    expect(text).toContain('Log tail (40):');
  });

  it('uses safe fallbacks when optional inputs are missing', () => {
    const text = formatDiagnostics({});
    expect(text).toContain('Version: unknown');
    expect(text).toContain('TV model: unknown');
    expect(text).toContain('Log tail (0):');
  });
});
