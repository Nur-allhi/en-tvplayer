// One-command release. See AGENTS.md §8.
// Usage: npm run release -- <X.Y.Z[-beta.N]> [--beta] [--yes] [--dry-run]
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import readline from 'node:readline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
const fail = (msg) => {
  console.error('release: ' + msg);
  process.exit(1);
};

const argv = process.argv.slice(2);
const version = argv.find((a) => !a.startsWith('--'));
const beta = argv.includes('--beta');
const autoYes = argv.includes('--yes');
const dryRun = argv.includes('--dry-run');

if (!version) fail('usage: npm run release -- <X.Y.Z[-beta.N]> [--beta] [--yes] [--dry-run]');
const pattern = beta ? /^\d+\.\d+\.\d+-beta\.\d+$/ : /^\d+\.\d+\.\d+$/;
if (!pattern.test(version)) fail(`version ${version} must match ${beta ? 'X.Y.Z-beta.N' : 'X.Y.Z'}`);
const base = version.split('-')[0];
const tag = 'v' + version;
const today = new Date().toISOString().slice(0, 10);

// ── Guards (read-only) ──────────────────────────────────────────────
if (sh('git status --porcelain')) {
  fail('working tree not clean — commit the changelog entries first, then run the release');
}
try {
  sh('gh auth status', { stdio: 'pipe' });
} catch {
  fail('gh not authenticated — run: gh auth login');
}
if (!existsSync(join(ROOT, 'tizen', 'author-key.pem'))) {
  fail(
    'tizen/author-key.pem missing — refusing to mint a fresh signing key (TVs would treat it as a new app). Restore the backup first.',
  );
}
const branch = sh('git rev-parse --abbrev-ref HEAD');
if (!beta && branch !== 'main') fail(`stable releases cut from main (on ${branch})`);
if (beta && branch === 'main') fail('beta releases cut from a non-main branch');
try {
  sh(`git rev-parse --verify ${tag}`, { stdio: 'pipe' });
  fail(`tag ${tag} already exists`);
} catch (e) {
  if (/already exists/.test(e.message)) throw e;
}
const readText = (relPath) => readFileSync(join(ROOT, relPath), 'utf8').replace(/\r\n/g, '\n');

// Docs use CRLF in this repo — normalize for matching, restore on write
// so release commits never contain phantom full-file diffs.
function readDoc(relPath) {
  const raw = readFileSync(join(ROOT, relPath), 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), eol: raw.includes('\r\n') ? '\r\n' : '\n' };
}
function writeDoc(relPath, text, eol) {
  writeFileSync(join(ROOT, relPath), eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}
const changelogMd = readText('CHANGELOG.md');
if (!/## \[Unreleased\]\n\n(\s*###)/.test(changelogMd))
  fail('CHANGELOG.md [Unreleased] is empty — write the release notes first');
const mainJs = readFileSync(join(ROOT, 'player', 'src', 'main.js'), 'utf8');
if (!mainJs.includes(`version: '${base}'`)) {
  fail(`player/src/main.js in-app CHANGELOG lacks version '${base}' — add the short entry first`);
}

// ── Plan ────────────────────────────────────────────────────────────
const assetName = beta ? `EN-IPTV_Player-testbuild-${version}.wgt` : `EN-IPTV_Player_v${version}.wgt`;
console.log(`release ${tag} (${beta ? 'beta' : 'stable'}) from ${branch}`);
console.log(`  asset: ${assetName}`);
if (!beta && !/^EN-IPTV_Player_v.*[.]wgt$/.test(assetName)) fail('asset name must match the community-bundle pattern');
if (dryRun) process.exit(0);

async function ask(question) {
  if (autoYes) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question + ' (y/N) ', (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

function bumpJson(relPath, newVersion) {
  const doc = readDoc(relPath);
  const data = JSON.parse(doc.text);
  data.version = newVersion;
  writeDoc(relPath, JSON.stringify(data, null, 2) + '\n', doc.eol);
}

// ── Version bumps ───────────────────────────────────────────────────
bumpJson('package.json', version);
bumpJson('player/package.json', version);
if (!beta) {
  const versionPath = join(ROOT, 'version.json');
  const versionData = JSON.parse(readFileSync(versionPath, 'utf8'));
  versionData.version = version;
  writeFileSync(versionPath, JSON.stringify(versionData)); // single line, no trailing newline (matches file style)
  const readme = readDoc('README.md');
  const badge = readme.text.match(/Current version: v[\d.]+/);
  if (!badge) fail('README.md version badge line not found');
  writeDoc('README.md', readme.text.replace(badge[0], `Current version: v${version}`), readme.eol);
  const changelog = readDoc('CHANGELOG.md');
  writeDoc('CHANGELOG.md', changelog.text.replace('## [Unreleased]', `## [${version}] - ${today}`), changelog.eol);
}

// ── Verify, build, package ──────────────────────────────────────────
run('npm test');
run('npm run lint');
run('npm run build -w player');
run('npm run tizen');

const outDir = join(ROOT, beta ? 'beta' : 'stable');
const built = readdirSync(outDir)
  .filter((f) => f.startsWith(`EN-IPTV_Player_v${version}_`) && f.endsWith('.wgt'))
  .map((f) => ({ file: f, mtime: statSync(join(outDir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime)[0];
if (!built) fail(`built WGT not found in ${outDir}/`);
if (Date.now() - built.mtime > 10 * 60 * 1000) fail('newest WGT is older than 10 minutes — the build may have failed');
const assetPath = beta ? join(outDir, assetName) : join(ROOT, 'releases', assetName);
copyFileSync(join(outDir, built.file), assetPath);
if (!beta) copyFileSync(assetPath, join(ROOT, 'releases', 'EN-IPTV_Player.wgt'));

// ── Release notes from the changelog ────────────────────────────────
function changelogSection(md, heading) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return '';
  const body = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) {
    body.push(lines[i].replace(/^### /, '## '));
  }
  return body.join('\n').trim();
}
const datedMd = beta ? changelogMd : readText('CHANGELOG.md');
const section = changelogSection(datedMd, beta ? '## [Unreleased]' : `## [${version}] - ${today}`);
const notes = beta
  ? `TEST BUILD - for sideload testing only, not for general use. Please report results on your issue before this becomes stable.\n\n## What's being tested\n${section}\n\n## How to test\nSideload the .wgt with Tizen Studio (tizen install) or Apps2Samsung sideload. No settings changes needed. If a channel fails, grab the inspector log and post the error lines.\n\nThis pre-release will NOT reach the community bundle; v${base} stable follows after testing.`
  : `${section}\n\nInstall via Apps2Samsung or sideload the .wgt with Tizen Studio.`;
const notesPath = join(tmpdir(), `release-notes-${version}.md`);
writeFileSync(notesPath, notes + '\n');

// ── Commit, tag, push, publish ──────────────────────────────────────
run('git add -A');
run(`git commit -m "${beta ? `chore(beta): prepare ${version}` : `release: ${tag}`}"`);
run(`git tag -a ${tag} -m "Release ${tag}"`);
if (!(await ask(`push commit + ${tag} to origin`))) fail('aborted before push');
run('git push');
run(`git push origin ${tag}`);
run(`gh release create ${tag} "${assetPath}" --title ${tag}${beta ? ' --prerelease' : ''} --notes-file "${notesPath}"`);

// ── Post-release stats (stable only: must postdate the release) ─────
if (!beta) {
  const stats = JSON.parse(
    sh(
      'gh api repos/Nur-allhi/en-tvplayer/releases --jq "[.[] | {tag: .tag_name, downloads: ([.assets[] | .download_count] | add)}]"',
    ),
  );
  const rows = stats.map((r) => `| ${r.tag} | ${r.downloads} |`).join('\n');
  const statsDoc = readDoc('docs/STATS.md');
  writeDoc(
    'docs/STATS.md',
    statsDoc.text.replace(
      /## Downloads by release \(.*?\)\n\n(\|.*\n)+/,
      `## Downloads by release (${today})\n\n| Release | Downloads |\n|---------|-----------|\n${rows}\n`,
    ),
    statsDoc.eol,
  );
  run('git add docs/STATS.md');
  run(`git commit -m "docs: refresh download stats for ${tag}"`);
  run('git push');
}

console.log(`\ndone: ${tag} released`);
