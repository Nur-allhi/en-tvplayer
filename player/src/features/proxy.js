// Desktop proxy relay feature (T-172). Contract: expose the test-relay menu
// only on a local/test host when Settings → Playback allows it, and hide it
// entirely when the `proxyTesting` feature is disabled. The app hub wires
// refreshProxyMenu into deps; it no longer owns these details.

import { getSettings } from '../config.js';
import { isEnabled } from '../app/plugins.js';
import { shouldShow } from './proxy-toggle.js';

export function refreshProxyMenu() {
  const btn = document.getElementById('proxy-toggle-btn');
  const label = document.getElementById('proxy-testing-label');
  const host = (typeof window !== 'undefined' && window.location.hostname) || '';
  const show = isEnabled('proxyTesting') && shouldShow(host, getSettings());
  if (btn) btn.classList.toggle('hidden', !show);
  if (label) label.classList.toggle('hidden', !show);
}
