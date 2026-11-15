// Commit message validator for EN TV Player.
//
// Enforces the format in docs/COMMIT_STYLE.md so the history stays
// greppable and every change is traceable to a ticket.
//
// Usage:
//   node scripts/check-commit-msg.mjs <path-to-message-file>   # hook mode
//   node scripts/check-commit-msg.mjs --audit                  # scan history
//
// Exit code 0 = valid, 1 = rejected (with the reasons).

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const TYPES = [
  'feat', // new user-facing capability
  'fix', // bug fix
  'refactor', // restructure, no behaviour change
  'perf', // performance
  'docs', // documentation
  'test', // tests only
  'chore', // tooling, deps, config, housekeeping
  'build', // build system and packaging
  'style', // formatting only, no semantics
  'merge', // merge commits (special: no scope, no ticket)
];

// Scopes map to the areas of the codebase. A closed list on purpose: an
// unbounded scope vocabulary is how "misc"/"stuff" scopes appear, and every
// scope here is one you would actually want to grep for.
const SCOPES = [
  // app source
  'player', // playback engine
  'ui', // UI layer and styles
  'settings', // settings page
  'remote', // remote / key handling
  'config', // config and storage
  'lib', // pure utilities and logic
  'app', // app orchestration and boot
  // tooling
  'tizen', // WGT packaging and signing
  'proxy', // desktop testing relay
  'release', // release tooling and process
  'tooling', // repo tooling: scripts, hooks, dev environment
  'ci', // GitHub Actions
  // documentation
  'docs', // documentation generally
  'session', // the session handover log
  'roadmap', // roadmap and plan documents
  'readme', // README
  'agents', // AGENTS.md
  'stats', // download statistics
  'repo', // repo-wide files (LICENSE, .gitignore)
];

// Types that change behaviour or quality — these MUST reference a ticket
// and MUST explain why in the body.
const TICKET_REQUIRED = new Set(['feat', 'fix', 'refactor', 'perf']);

const HEADER_RE = /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9-]+)\))?(?<bang>!)?: (?<subject>.+)$/;
const TICKET_RE = /T-\d{3,}/;
const MAX_HEADER = 72;
const MAX_BODY_LINE = 100;

// Subjects that carry no information. Never acceptable alone.
const JUNK_SUBJECTS = new Set(['fix', 'wip', 'update', 'changes', 'stuff', 'misc', 'tmp', 'test', '.']);

function validate(message, { label = 'commit message' } = {}) {
  const problems = [];

  // Strip comment lines (git may include them from an editor template).
  const lines = message.split('\n').filter((l) => !l.startsWith('#'));
  const raw = lines.join('\n').replace(/\s+$/, '');
  if (!raw.trim()) {
    return [`${label} is empty`];
  }

  const bodyLines = lines.slice(1);
  // A body line is any non-empty line that is not a footer.
  const footerStart = bodyLines.findIndex((l) => /^[A-Za-z-]+: /.test(l) || l.startsWith('BREAKING CHANGE:'));
  const body = (footerStart === -1 ? bodyLines : bodyLines.slice(0, footerStart)).filter((l) => l.trim());
  const footers = footerStart === -1 ? [] : bodyLines.slice(footerStart).filter((l) => l.trim());

  const header = lines[0] || '';
  const m = HEADER_RE.exec(header);

  if (!m) {
    problems.push(`header does not match "<type>(<scope>): <subject>"\n` + `         got: ${header}`);
    return problems;
  }

  const { type, scope, bang } = m.groups;

  // The subject may carry a trailing ticket reference "(T-123)". Strip it
  // first, so the remaining text is validated on its own terms.
  let subject = m.groups.subject.trim();
  let subjectTicket = null;
  const ticketSuffix = subject.match(/\s*\((T-\d{3,})\)\s*$/);
  if (ticketSuffix) {
    subjectTicket = ticketSuffix[1];
    subject = subject.slice(0, ticketSuffix.index).trim();
  }

  if (!TYPES.includes(type)) {
    problems.push(`unknown type "${type}" — use one of: ${TYPES.join(', ')}`);
  }

  if (scope && !SCOPES.includes(scope)) {
    problems.push(`unknown scope "${scope}" — use one of: ${SCOPES.join(', ')}`);
  }

  if (type === 'merge') {
    // Merge commits carry no scope and need no ticket.
    if (scope) problems.push('merge commits take no scope — use "merge: <what>"');
  } else if (!scope) {
    problems.push(`missing scope — pick one of: ${SCOPES.join(', ')}`);
  }

  // Subject checks
  if (!subject) {
    problems.push('subject is empty');
  } else {
    if (JUNK_SUBJECTS.has(subject.toLowerCase().replace(/[.!]+$/, ''))) {
      problems.push(`subject "${subject}" says nothing — describe the change`);
    }
    if (/\.$/.test(subject)) {
      problems.push('subject must not end with a period');
    }
    if (/\s{2,}/.test(subject)) {
      problems.push('subject contains multiple consecutive spaces');
    }
    if (/^[A-Z]/.test(subject)) {
      problems.push('subject must start lowercase (it continues the type prefix)');
    }
    if (/\b(WIP|TODO|FIXME|XXX)\b/i.test(subject)) {
      problems.push('subject must not contain WIP/TODO/FIXME/XXX');
    }
  }

  // Header length
  if (header.length > MAX_HEADER) {
    problems.push(`header is ${header.length} characters — keep it at ${MAX_HEADER} or fewer`);
  }

  // Ticket traceability. When a ticket IS present it must sit in the
  // subject so that `git log --oneline` and `git log --grep=T-123` both
  // find it. Behaviour-changing commits must always carry one.
  if (type !== 'merge') {
    if (subjectTicket && !TICKET_RE.test(subjectTicket)) {
      problems.push(`ticket "${subjectTicket}" is not a valid ticket id (T-123)`);
    } else if (!subjectTicket && TICKET_REQUIRED.has(type)) {
      problems.push(`a "${type}" commit must reference a ticket in the subject — "… (T-123)"`);
    }
  }

  // Body: required for behaviour-changing types, and it must explain why.
  if (TICKET_REQUIRED.has(type) && body.length === 0) {
    problems.push(`a "${type}" commit needs a body — explain WHY the change was needed, not WHAT the diff shows`);
  }

  for (const line of body) {
    if (line.length > MAX_BODY_LINE) {
      problems.push(`body line is ${line.length} characters — wrap at ${MAX_BODY_LINE}`);
    }
  }

  // Footers
  for (const f of footers) {
    if (/^closes:/i.test(f)) {
      if (!TICKET_RE.test(f)) problems.push(`footer "${f}" must name a ticket, e.g. "Closes: T-123"`);
    } else if (/^refs:/i.test(f)) {
      if (!TICKET_RE.test(f)) problems.push(`footer "${f}" must name a ticket, e.g. "Refs: T-123"`);
    } else if (/^breaking change:/i.test(f)) {
      // allowed, free text
    } else if (!/^[A-Za-z-]+: /.test(f)) {
      problems.push(`footer "${f}" is not a recognised trailer`);
    }
  }

  // Breaking changes must be announced in the subject too.
  if (bang && !/^BREAKING CHANGE:/im.test(raw)) {
    problems.push('"!" in the header requires a "BREAKING CHANGE:" footer');
  }

  return problems;
}

// ── Audit the existing history ───────────────────────────────────────────
function audit() {
  // Use a record separator that cannot appear in a commit message.
  const SEP = '\x1e';
  const RS = '\x1d';
  const raw = execSync(`git log --format=%H${RS}%B${SEP}`, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  const entries = raw.split(SEP).filter((e) => e.trim());
  let checked = 0;
  const offenders = [];

  for (const entry of entries) {
    const [sha, ...rest] = entry.split(RS);
    const message = rest.join(RS).replace(/\n+$/, '');
    if (!message || !message.trim()) continue;
    const subjectLine = message.split('\n')[0].trim();
    // Skip auto-generated merge and release commits.
    if (/^(release:|chore\(beta\):|merge:|Merge )/.test(subjectLine)) continue;
    checked++;
    const problems = validate(message, { label: `commit ${sha.slice(0, 7)}` });
    if (problems.length) offenders.push({ sha: sha.slice(0, 7), subject: subjectLine, problems });
  }

  console.log(`\nCOMMIT MESSAGE AUDIT\n${'─'.repeat(52)}`);
  console.log(`checked ${checked} commit(s) against docs/COMMIT_STYLE.md`);
  console.log(`non-conforming: ${offenders.length}\n`);
  for (const o of offenders.slice(0, 40)) {
    console.log(`  ${o.sha}  ${o.subject}`);
    for (const p of o.problems) console.log(`         - ${p}`);
  }
  if (offenders.length > 40) console.log(`\n  … and ${offenders.length - 40} more`);
  console.log('');
  process.exit(0);
}

// ── Hook mode ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes('--audit')) {
  audit();
}

const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: node scripts/check-commit-msg.mjs <message-file> | --audit');
  process.exit(1);
}

const message = readFileSync(file, 'utf8');

// Merge commits are generated by git; their message is the merge description.
if (/^Merge (branch|remote-tracking branch|pull request)/.test(message)) {
  process.exit(0);
}
// Reverts and fixups carry their own conventional markers.
if (/^(Revert |fixup!|squash!|amend!)/.test(message)) {
  process.exit(0);
}

const problems = validate(message);
if (problems.length) {
  console.error('\ncommit message rejected:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nFormat: <type>(<scope>): <subject> (T-123)');
  console.error('Types:   ' + TYPES.join(', '));
  console.error('Scopes:  ' + SCOPES.join(', '));
  console.error('See docs/COMMIT_STYLE.md for the full rules and examples.\n');
  process.exit(1);
}
