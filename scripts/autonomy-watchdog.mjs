// Autonomy watchdog (2026-11-17). Keeps the development window saturated
// without ever starting two agents on the same worktree.
//
// OpenChamber's /scheduled-tasks/status reports 0 running for a run it has
// merely *admitted* ("sent"), so it cannot be trusted for overlap detection.
// This script checks actual OpenCode sessions via `opencode api` (the CLI
// wrapper carries auth; a raw fetch to port 28894 returns 401).
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const DATA = process.env.OPENCHAMBER_DATA_DIR || `${process.env.USERPROFILE}/.config/openchamber`;
const PROJECT_ID = 'path_QzovVXNlcnMvRWZ0eW51clBjL0RvY3VtZW50cy8wMl9Xb3JrL0Rldl9Qcm9qZWN0cy9lbi10dnBsYXllcg';
const TASK_ID = '35194797-b718-46d4-8066-22a54de716e0';
const API = 'http://127.0.0.1:3000';
const STALE_MS = 90_000; // a session idle this long is finished

const mins = (() => {
  const p = new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [h, m] = p.split(':').map(Number);
  return h * 60 + m;
})();

const stop = (reason) => {
  console.log(JSON.stringify({ fire: false, reason, mins }));
  process.exit(0);
};

if (mins < 13 * 60 + 30 || mins >= 19 * 60 + 30) stop('outside window');

const queue = readFileSync('docs/AUTONOMY.md', 'utf8');
const next = (queue.match(/^NEXT\s*=\s*(\S+)/m) || [])[1] || 'none';
if (next === 'none') stop('queue exhausted');

const cfg = JSON.parse(readFileSync(`${DATA}/projects/${PROJECT_ID}.json`, 'utf8'));
const task = cfg.scheduledTasks.find((t) => t.id === TASK_ID);
if (!task || !task.enabled) stop('task disabled');

const OPENCODE = `"${process.env.APPDATA}/npm/opencode.cmd"`;
const sessions = JSON.parse(
  execSync(`${OPENCODE} api get /api/session`, {
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
);
const active = (sessions.data || []).filter(
  (s) => /^nightshift /.test(s.title || '') && !s.outcome && Date.now() - (s.time?.updated || 0) < STALE_MS,
);
if (active.length) stop(`active session ${active[0].id}`);

const res = await fetch(`${API}/api/projects/${PROJECT_ID}/scheduled-tasks/${TASK_ID}/run`, {
  method: 'POST',
});
console.log(JSON.stringify({ fire: true, ok: res.ok, status: res.status, next }));
