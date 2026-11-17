// Desktop proxy relay feature (T-172). Contract: expose the test-relay menu
// only on a local/test host when Settings → Playback allows it, and hide it
// entirely when the `proxyTesting` feature is disabled. The app hub wires
// refreshProxyMenu into deps; the pure host/settings gate lives in
// proxy-toggle.js. The feature declares its own remote route here too (T-173),
// so adding a key needs no edit to app/remote.js.
import { getSettings } from '../config.js';
import { FEATURES, isEnabled, registerFeature } from '../app/plugins.js';
import { shouldShow } from './proxy-toggle.js';

registerFeature('proxyTesting', {
  ...FEATURES.proxyTesting,
  routes: { proxy: () => refreshProxyMenu() },
});

export function refreshProxyMenu() {
  const btn = document.getElementById('proxy-toggle-btn');
  const label = document.getElementById('proxy-testing-label');
  const host = (typeof window !== 'undefined' && window.location.hostname) || '';
  const show = isEnabled('proxyTesting') && shouldShow(host, getSettings());
  if (btn) btn.classList.toggle('hidden', !show);
  if (label) label.classList.toggle('hidden', !show);
}
