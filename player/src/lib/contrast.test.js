import { describe, it, expect } from 'vitest';
import { contrastRatio, auditPalette } from './contrast.js';

describe('contrastRatio', () => {
  it('returns 21:1 for black on white', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
  });

  it('returns 1:1 for identical colours', () => {
    expect(contrastRatio('#1a1a1a', '#1a1a1a')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#c9d1d9', '#0d1117')).toBeCloseTo(contrastRatio('#0d1117', '#c9d1d9'), 5);
  });

  it('matches the WCAG reference value for mid grey on white', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('expands three-digit hex colours', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(contrastRatio('#ffffff', '#000000'), 5);
  });
});

describe('auditPalette', () => {
  const palette = {
    surfaces: {
      canvas: '#0a0e14',
      surface: '#0d1117',
      hover: '#242424',
      dialog: '#1c2128',
    },
    text: {
      muted: '#c9d1d9',
      faint: '#939aa2',
    },
    ui: {
      accent: '#ed421f',
      danger: '#d32f2f',
    },
  };

  it('passes when body text clears 4.5:1 and UI accents clear 3:1', () => {
    expect(auditPalette(palette)).toEqual([]);
  });

  it('reports body text below 4.5:1', () => {
    const failing = { surfaces: { hover: '#242424' }, text: { bad: '#767676' } };
    const failures = auditPalette(failing);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ name: 'bad', surface: 'hover', required: 4.5 });
    expect(failures[0].ratio).toBeLessThan(4.5);
  });

  it('reports every surface a token fails on', () => {
    const failing = { ...palette, ui: { danger: '#4a4a4a' } };
    const failures = auditPalette(failing);
    expect(failures).toHaveLength(4);
    expect(failures.every((f) => f.required === 3)).toBe(true);
  });

  it('keeps the reported ratio rounded to two decimals', () => {
    const [failure] = auditPalette({ surfaces: { hover: '#242424' }, text: { bad: '#767676' } });
    expect(Number.isInteger(failure.ratio * 100)).toBe(true);
  });
});
