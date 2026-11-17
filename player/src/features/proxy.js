// Desktop proxy relay feature (T-172). Contract: expose the test-relay menu
// only on a local/test host when Settings → Playback allows it, and hide it
// entirely when the `proxyTesting` feature is disabled. The app hub wires
// refreshProxyMenu into deps; it no longer owns these details.
import { getSettings } from '../config.js';
import { isEnabled } from '../app/plugins.js';

const LOCAL_HOSTS = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

function isLocalHost() {
  const host = (typeof window !== 'undefined' && window.location.hostname) || '';
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    LOCAL_HOSTS.test(host)
  );
}

export function refreshProxyMenu() {
  const btn = document.getElementById('proxy-toggle-btn');
  const label = document.getElementById('proxy-testing-label');
  if (!isEnabled('proxyTesting')) {
    if (btn) btn.classList.add('hidden');
    if (label) label.classList.add('hidden');
    return;
  }
  const show = isLocalHost() && getSettings().showProxyMenu === true;
  if (btn) btn.classList.toggle('hidden', !show);
  if (label) label.classList.toggle('hidden', !show);
}
