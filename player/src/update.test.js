import { describe, it, expect } from 'vitest';
import { compareVersions } from './update.js';

describe('compareVersions', () => {
  it('reports equal versions as 0', () => {
    expect(compareVersions('3.2.0', '3.2.0')).toBe(0);
  });

  it('detects newer major/minor/patch releases', () => {
    expect(compareVersions('4.0.0', '3.9.9')).toBeGreaterThan(0);
    expect(compareVersions('3.3.0', '3.2.9')).toBeGreaterThan(0);
    expect(compareVersions('3.2.1', '3.2.0')).toBeGreaterThan(0);
  });

  it('detects older versions as negative', () => {
    expect(compareVersions('3.1.9', '3.2.0')).toBeLessThan(0);
  });

  it('treats missing segments as zero', () => {
    expect(compareVersions('3.2', '3.2.0')).toBe(0);
  });
});
