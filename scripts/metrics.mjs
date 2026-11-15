// Project metrics for EN TV Player.
//
// Prints the numbers the v4 plan is measured against (docs/v4.PLAN.md §2):
// file sizes, how many files break the 300-LOC rule, bundle weight, and
// the test count.
//
// Usage: npm run metrics

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'player', 'src');
const DIST = join(ROOT, 'player', 'dist', 'assets');
const MAX_LOC = 300;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function kb(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

// ── Source sizes ─────────────────────────────────────────────────────────
const sourceFiles = walk(SRC).filter((f) => !f.includes('node_modules'));
const rows = sourceFiles
  .map((f) => ({
    file: relative(ROOT, f).replace(/\\/g, '/'),
    loc: readFileSync(f, 'utf8').split('\n').length,
  }))
  .sort((a, b) => b.loc - a.loc);

const jsRows = rows.filter((r) => r.file.endsWith('.js') && !r.file.endsWith('.test.js'));
const testRows = rows.filter((r) => r.file.endsWith('.test.js'));
const cssRows = rows.filter((r) => r.file.endsWith('.css'));
const over = rows.filter((r) => r.loc > MAX_LOC);

console.log('\nSOURCE FILES');
console.log('─'.repeat(52));
for (const r of rows) {
  const flag = r.loc > MAX_LOC ? '  <- over limit' : '';
  console.log(String(r.loc).padStart(6) + '  ' + r.file + flag);
}

const sum = (arr) => arr.reduce((n, r) => n + r.loc, 0);
console.log('─'.repeat(52));
console.log(
  `app JS ${sum(jsRows)} LOC (${jsRows.length} files) · tests ${sum(testRows)} LOC ` +
    `(${testRows.length} files) · css ${sum(cssRows)} LOC`,
);
console.log(
  `files over ${MAX_LOC} LOC: ${over.length}` +
    (over.length ? '  → ' + over.map((r) => r.file.replace('player/src/', '')).join(', ') : ''),
);

// ── Tests ────────────────────────────────────────────────────────────────
let testCount = 0;
for (const r of testRows) {
  const src = readFileSync(join(ROOT, r.file), 'utf8');
  testCount += (src.match(/\bit\s*\(/g) || []).length;
}
console.log(`\nTESTS\n${'─'.repeat(52)}\n${testCount} test cases in ${testRows.length} files`);

// ── Bundle ───────────────────────────────────────────────────────────────
console.log(`\nBUNDLE\n${'─'.repeat(52)}`);
if (existsSync(DIST)) {
  for (const f of readdirSync(DIST).filter((n) => n.endsWith('.js'))) {
    const size = statSync(join(DIST, f)).size;
    console.log(`${kb(size).padStart(10)}  dist/assets/${f}`);
  }
  const html = join(ROOT, 'player', 'dist', 'index.html');
  if (existsSync(html)) {
    console.log(`${kb(statSync(html).size).padStart(10)}  dist/index.html`);
  }
  console.log('\n(run `npm run build` first if this looks stale)');
} else {
  console.log('no build found — run `npm run build`');
}
console.log('');
