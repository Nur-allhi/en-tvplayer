// Pure diagnostics text builder (T-200). Produces a clipboard-ready block that
// contains no PII or stream tokens — callers pass only already-redacted lines.

import { redactLine } from './ring-buffer.js';

const MAX_TAIL_LINES = 40;

export function formatDiagnostics({ version, tvModel, logTail } = {}) {
  const tail = Array.isArray(logTail) ? logTail.slice(-MAX_TAIL_LINES).map(redactLine) : [];
  const lines = [
    'EN IPTV Player diagnostics',
    'Version: ' + (version || 'unknown'),
    'TV model: ' + (tvModel || 'unknown'),
    'Log tail (' + tail.length + '):',
    ...tail,
  ];
  return lines.join('\n');
}
