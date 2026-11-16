// Relative and absolute time formatting for the settings page. Pure: the
// caller passes the instant to compare against, so the result is testable
// without freezing the clock.

const NEVER = 'Never';

function toDate(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(isoString, locale) {
  const d = toDate(isoString);
  if (!d) return NEVER;
  return locale ? d.toLocaleDateString(locale) : d.toLocaleDateString();
}

export function timeAgo(isoString, now, locale) {
  const d = toDate(isoString);
  if (!d) return NEVER;
  const reference = now === undefined || now === null ? Date.now() : now;
  const seconds = Math.floor((reference - d.getTime()) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  return locale ? d.toLocaleDateString(locale) : d.toLocaleDateString();
}
