// Feature: desktop proxy test menu.
//
// Contract (T-172): owns the visibility of #proxy-toggle-btn and
// #proxy-testing-label. `refresh(enabled)` is the only integration point; the
// caller supplies whether the feature is enabled so this module never imports
// app/ (imports must flow downward). The click binding stays in app/shell.js
// until T-173 routes it as a feature action.

import { getSettings } from '../config.js';

export const contract = {
  id: 'proxyTesting',
  owns: ['#proxy-toggle-btn', '#proxy-testing-label'],
  routes: [],
  menuEntries: [],
};

export default contract;

// Local hosts only — never the file:// TV build (empty hostname).
export function isLocalHost(host) {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(host)
  );
}

export function shouldShow(host, settings) {
  return isLocalHost(host) && settings.showProxyMenu === true;
}

// Kept as the deps slot name so shell.js's settings-close refresh is unchanged.
export function refresh(enabled) {
  const btn = document.getElementById('proxy-toggle-btn');
  const label = document.getElementById('proxy-testing-label');
  const host = (typeof window !== 'undefined' && window.location.hostname) || '';
  const show = enabled && shouldShow(host, getSettings());
  if (btn) btn.classList.toggle('hidden', !show);
  if (label) label.classList.toggle('hidden', !show);
}
