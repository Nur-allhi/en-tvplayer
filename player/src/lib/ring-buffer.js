// Pure in-memory log ring (T-200). DOM-free and side-effect free on import
// apart from the shared instance at the bottom. Bounded so a long TV session
// cannot grow memory without limit; redacted on write so a stream token or an
// address pasted into a log line can never reach a public GitHub issue.

import { redactUrl } from './url.js';

const DEFAULT_LIMIT = 200;
const URL_WITH_QUERY = /(https?:\/\/[^\s'"]+?)[?#][^\s'"]*/g;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

// Same query/fragment rule logEvent already used, plus the shared redactor and
// a plain address scrub. redactUrl alone only handles a whole-string URL.
export function redactLine(message) {
  const text = typeof message === 'string' ? message : String(message);
  return redactUrl(text.replace(URL_WITH_QUERY, '$1').replace(EMAIL, '[email]'));
}

export function createLogRing(limit = DEFAULT_LIMIT) {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
  const entries = [];

  return {
    get size() {
      return entries.length;
    },

    push(level, message) {
      entries.push('[' + level + '] ' + redactLine(message));
      if (entries.length > cap) entries.shift();
    },

    tail(n) {
      if (n === 0) return [];
      const count = Number.isFinite(n) && n >= 0 ? Math.floor(n) : entries.length;
      return entries.slice(Math.max(0, entries.length - count));
    },

    toText(n) {
      return this.tail(n).join('\n');
    },
  };
}

// One ring shared by every logEvent caller in the app.
export const appLogRing = createLogRing(DEFAULT_LIMIT);
