// Accessibility audit (T-162). Fails the build when the design tokens slip
// below WCAG contrast minimums or a status/dialog loses its aria contract.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { auditPalette, contrastRatio } from '../player/src/lib/contrast.js';

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const base = read('../player/src/styles/base.css');
const html = read('../player/index.html');
const components = read('../player/src/styles/components.css');
const overlays = read('../player/src/styles/overlays.css');

const failures = [];
const fail = (message) => failures.push(message);

// Tokens come from base.css so the audit cannot drift from the shipped palette.
const tokens = Object.fromEntries(
  [...base.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map((m) => [m[1], m[2]]),
);
const pick = (prefix) => Object.fromEntries(Object.entries(tokens).filter(([name]) => name.startsWith(prefix)));
const named = (...names) => Object.fromEntries(names.map((name) => [name, tokens[name]]));

const failuresContrast = auditPalette({
  surfaces: pick('c-surface-'),
  text: {
    ...pick('c-text-'),
    ...named('c-white', 'c-accent-text', 'c-success', 'c-warning', 'c-info'),
  },
  ui: named('c-accent', 'c-danger'),
});
for (const f of failuresContrast) {
  fail(`contrast: ${f.name} on ${f.surface} is ${f.ratio}:1 (needs ${f.required}:1)`);
}

// Primary button labels are white on the darker brand accent.
const buttonRatio = contrastRatio(tokens['c-white'], tokens['c-accent-strong']);
if (buttonRatio < 4.5) {
  fail(`contrast: white on c-accent-strong is ${buttonRatio.toFixed(2)}:1 (needs 4.5:1)`);
}

// Status and dialog semantics that assistive tech relies on.
const element = (id) => html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))?.[0] || '';
const attrs = {
  'loading-name': 'aria-live="polite"',
  'buffering-hint': 'aria-live="polite"',
  'progress-text': 'aria-live="polite"',
  'boot-status': 'aria-live="polite"',
  error: 'role="alert"',
  'playpause-button': 'aria-label=',
};
for (const [id, attr] of Object.entries(attrs)) {
  if (!element(id).includes(attr)) fail(`aria: #${id} is missing ${attr}`);
}
for (const id of ['settings-page', 'whats-new-modal', 'onboarding-modal', 'confirm-dialog']) {
  const tag = element(id);
  if (!tag.includes('role="dialog"') || !tag.includes('aria-modal="true"')) {
    fail(`aria: #${id} must be role="dialog" aria-modal="true"`);
  }
}
if (!/<html[^>]+lang=/.test(html)) fail('aria: <html> is missing lang');

// Motions, focus and non-colour feedback must stay in the stylesheets.
if (!base.includes('prefers-reduced-motion')) fail('motion: missing prefers-reduced-motion block');
if (!/:focus/.test(base)) fail('focus: missing focus ring rule in base.css');
if (!/\.error::before\s*\{[^}]*content:/s.test(overlays)) fail('icon: .error needs a glyph');
if (!/\.status-info\.is-success::before\s*\{[^}]*content:/s.test(components)) {
  fail('icon: success status needs a glyph');
}

if (failures.length) {
  console.error(`a11y audit FAILED (${failures.length})`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log('a11y audit ok — contrast, aria, focus, motion and status glyphs pass');
