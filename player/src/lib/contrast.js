// Pure WCAG 2.1 contrast maths for the design-token audit. No DOM, no fs.

const linearise = (value) => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const channels = (hex) => {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw;
  return [0, 2, 4].map((i) => linearise(parseInt(full.slice(i, i + 2), 16)));
};

export function relativeLuminance(hex) {
  const [r, g, b] = channels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [light, dark] = a >= b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

// Body text must clear 4.5:1; accent/danger UI marks only need 3:1 (WCAG 1.4.11).
export function auditPalette({ surfaces = {}, text = {}, ui = {} } = {}) {
  const failures = [];
  const check = (group, tokens, required) => {
    for (const [name, fg] of Object.entries(tokens)) {
      for (const [surface, bg] of Object.entries(surfaces)) {
        const ratio = contrastRatio(fg, bg);
        if (ratio < required) {
          failures.push({
            group,
            name,
            surface,
            ratio: Math.round(ratio * 100) / 100,
            required,
          });
        }
      }
    }
  };
  check('text', text, 4.5);
  check('ui', ui, 3);
  return failures;
}
