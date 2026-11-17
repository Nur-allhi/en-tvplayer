// Per-commit autonomy report (2026-11-17). Called by .husky/post-commit so
// the maintainer gets a written record of every unattended commit without
// waiting for a chat reply. Never fails the commit.
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const run = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const report = 'docs/AUTONOMY_REPORT.md';

try {
  const sha = run(['rev-parse', '--short', 'HEAD']);
  const subject = run(['log', '-1', '--format=%s']);
  const queue = readFileSync('docs/AUTONOMY.md', 'utf8');

  const rows = [...queue.matchAll(/^\| \d+ \| (T-[\w]+) \|[^|]*\| (ready|done|needs-tv|proposed|partial) \|/gm)];
  const total = rows.length;
  const doneTickets = rows.filter((r) => r[2] === 'done').length;
  const pending = rows.filter((r) => r[2] === 'ready').length;
  const next = (queue.match(/^NEXT\s*=\s*(\S+)/m) || [])[1] || 'none';
  const ts = new Date().toISOString();

  const line = `| ${ts} | \`${sha}\` | ${subject.replace(/\|/g, '\\|')} | ${doneTickets}/${total} | ${pending} | ${next} |\n`;

  if (!existsSync(report) || !readFileSync(report, 'utf8').includes('# AUTONOMY REPORT')) {
    writeFileSync(
      report,
      `# AUTONOMY REPORT\n\nOne row per commit during unattended runs. Newest last.\n\n| Time (UTC) | Commit | Subject | Queue done | Ready | Next |\n|---|---|---|---|---|---|\n`,
    );
  }
  appendFileSync(report, line);
} catch {
  // Reporting must never break a commit.
}
