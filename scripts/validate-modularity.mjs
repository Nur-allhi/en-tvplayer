// Modularity guard for EN TV Player.
//
// Enforces the rules in docs/v4.PLAN.md §3.2 so "every file <= 300 LOC" and
// "no circular imports" are CI-enforced, not aspirational.
//
// Usage:
//   node scripts/validate-modularity.mjs            # check against the baseline
//   node scripts/validate-modularity.mjs --strict   # fail on any violation
//   node scripts/validate-modularity.mjs --update   # accept the current state
//
// Ratchet model: the repo starts with known violations (the v3.2.0 monoliths).
// The baseline file records them. CI fails on NEW violations, so the debt can
// only shrink. Each v4 phase shrinks the baseline; the final phase empties it
// and the script runs in --strict mode permanently.
//
// Exit code 0 = no new violations, 1 = new violations found.

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'player', 'src');
const BASELINE_FILE = join(ROOT, 'scripts', 'modularity-baseline.json');

const MAX_LOC = 300;
const MAX_EXPORTS = 15;

// Pure zones: DOM-free, safe to unit test without a DOM.
const DOM_FREE_FILES = ['logic.js'];
const DOM_FREE_DIRS = ['lib'];

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const update = args.includes('--update');

const errors = [];

function rel(p) {
  return relative(ROOT, p).replace(/\\/g, '/');
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

// Strip comments so a mention in prose does not count as a violation.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ── Rule 1: file size ────────────────────────────────────────────────────
function checkSize(files) {
  for (const f of files) {
    const loc = readFileSync(f, 'utf8').split('\n').length;
    if (loc > MAX_LOC) {
      errors.push({ rule: 'loc', id: rel(f), detail: `${loc} LOC exceeds ${MAX_LOC}` });
    }
  }
}

// ── Rule 2: export count ─────────────────────────────────────────────────
function checkExports(files) {
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const names = new Set();
    for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/gm)) {
      names.add(m[1]);
    }
    for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
      for (const part of m[1].split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+/)
          .pop();
        if (name) names.add(name.trim());
      }
    }
    if (names.size > MAX_EXPORTS) {
      errors.push({ rule: 'exports', id: rel(f), detail: `${names.size} exports exceeds ${MAX_EXPORTS}` });
    }
  }
}

// ── Rule 3: no circular imports ──────────────────────────────────────────
function checkCircular(files) {
  const graph = new Map();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const deps = [];
    for (const m of src.matchAll(/(?:^|\s)(?:import|export)[^'"\n]*from\s+['"](\.[^'"]+)['"]/g)) {
      deps.push(m[1]);
    }
    graph.set(f, deps);
  }

  const resolved = new Map();
  for (const [from, deps] of graph) {
    const list = [];
    for (const d of deps) {
      const target = join(dirname(from), d);
      if (graph.has(target)) list.push(target);
    }
    resolved.set(from, list);
  }

  const state = new Map();
  const stack = [];
  let found = false;

  function visit(node) {
    if (found) return;
    state.set(node, 1);
    stack.push(node);
    for (const next of resolved.get(node) || []) {
      const s = state.get(next) || 0;
      if (s === 1) {
        const cycle = stack.slice(stack.indexOf(next)).concat(next).map(rel);
        errors.push({ rule: 'circular', id: cycle[0], detail: `circular import: ${cycle.join(' -> ')}` });
        found = true;
        return;
      }
      if (s === 0) visit(next);
    }
    stack.pop();
    state.set(node, 2);
  }

  for (const f of files) {
    if ((state.get(f) || 0) === 0) visit(f);
    if (found) return;
  }
}

// ── Rule 4: pure zones stay DOM-free ─────────────────────────────────────
function checkDomFree(files) {
  for (const f of files) {
    const relPath = rel(f);
    const name = relPath.split('/').pop();
    if (!DOM_FREE_FILES.includes(name) && !DOM_FREE_DIRS.some((d) => relPath.includes(`/${d}/`))) continue;

    const code = stripComments(readFileSync(f, 'utf8'));
    const hits = [];
    if (/\bdocument\b/.test(code)) hits.push('document');
    if (/\bwindow\b/.test(code)) hits.push('window');
    if (/\blocalStorage\b/.test(code)) hits.push('localStorage');
    if (/\bnavigator\b/.test(code)) hits.push('navigator');
    if (hits.length) {
      errors.push({ rule: 'dom-free', id: relPath, detail: `must stay DOM-free but references ${hits.join(', ')}` });
    }
  }
}

// ── Rule 5: no leftover debug output ─────────────────────────────────────
function checkNoDebug(files) {
  for (const f of files) {
    const code = stripComments(readFileSync(f, 'utf8'));
    if (/console\.log\(/.test(code)) {
      errors.push({ rule: 'debug', id: rel(f), detail: 'console.log() found — use console.debug/warn/error' });
    }
  }
}

// ── Baseline handling ────────────────────────────────────────────────────
function key(e) {
  return `${e.rule}:${e.id}`;
}

const files = walk(SRC);
checkSize(files);
checkExports(files);
checkCircular(files);
checkDomFree(files);
checkNoDebug(files);

if (update) {
  const byKey = {};
  for (const e of errors) byKey[key(e)] = { rule: e.rule, file: e.id, detail: e.detail };
  writeFileSync(BASELINE_FILE, JSON.stringify(byKey, null, 2) + '\n');
  console.log(`baseline updated — ${Object.keys(byKey).length} known violation(s) recorded`);
  process.exit(0);
}

const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) : {};

const known = new Set(Object.keys(baseline));
const fresh = errors.filter((e) => !known.has(key(e)));
const resolved = [...known].filter((k) => !errors.some((e) => key(e) === k));

if (resolved.length && !strict) {
  console.log(`modularity: ${resolved.length} baseline violation(s) resolved — run --update to shrink the baseline`);
  for (const k of resolved) console.log(`  fixed  ${k}`);
}

if (fresh.length) {
  console.error('\nmodularity check failed — new violation(s):\n');
  for (const e of fresh) console.error(`  error  [${e.rule}] ${e.id}: ${e.detail}`);
  console.error(`\n${fresh.length} new violation(s). See docs/v4.PLAN.md §3.2.\n`);
  process.exit(1);
}

const remaining = errors.length;
console.log(
  `modularity ok — ${files.length} files, 0 new violations` +
    (remaining ? ` (${remaining} known violation(s) tracked in the baseline)` : ''),
);
