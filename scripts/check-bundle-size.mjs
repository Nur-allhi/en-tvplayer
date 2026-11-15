// Bundle size gate for EN TV Player.
//
// The TV has limited memory; the shipped bundle must stay under the budget
// in docs/v4.PLAN.md §1.1 (G3: <= 1.1 MB raw).
//
// Usage: node scripts/check-bundle-size.mjs
// Exit code 0 = under budget, 1 = over.

import { readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'player', 'dist', 'assets');
const BUDGET_KB = 1126; // 1.1 MB

if (!existsSync(DIST)) {
  console.error('no build found — run `npm run build` first');
  process.exit(1);
}

let total = 0;
const files = [];
for (const f of readdirSync(DIST).filter((n) => n.endsWith('.js'))) {
  const size = statSync(join(DIST, f)).size;
  total += size;
  files.push({ name: f, size });
}

if (!files.length) {
  console.error('no JS bundle in dist/assets — run `npm run build` first');
  process.exit(1);
}

console.log('\nBUNDLE SIZE');
console.log('─'.repeat(52));
for (const f of files) {
  console.log(`${(f.size / 1024).toFixed(1).padStart(10)} KB  ${f.name}`);
}
const kb = total / 1024;
const pct = ((kb / BUDGET_KB) * 100).toFixed(1);
console.log('─'.repeat(52));
console.log(`${kb.toFixed(1).padStart(10)} KB  total (${pct}% of the ${BUDGET_KB} KB budget)`);

if (kb > BUDGET_KB) {
  console.error(`\nbundle over budget by ${(kb - BUDGET_KB).toFixed(1)} KB\n`);
  process.exit(1);
}
console.log('\nunder budget\n');
