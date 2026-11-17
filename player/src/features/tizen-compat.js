// Tizen platform compatibility feature (T-172). Owns virtual-key registration
// and the hardware Back key; the pure capability probe stays in lib/. Both
// setup functions no-op off Tizen.

import { capabilities } from '../capabilities.js';
import { hasTvKeyInput } from '../lib/capabilities.js';

export const contract = {
  id: 'tizenCompat',
  owns: ['tvinputdevice.registerKey', 'tizenhwkey back'],
  routes: [],
  menuEntries: [],
};

export default contract;

const KEYS = [
  'ColorF0Red',
  'ColorF1Green',
  'ColorF2Yellow',
  'ColorF3Blue',
  'MediaPlayPause',
  'MediaPlay',
  'MediaPause',
  'MediaStop',
  'MediaFastForward',
  'MediaRewind',
  'MediaTrackNext',
  'MediaTrackPrevious',
  'ChannelUp',
  'ChannelDown',
];

export function registerTizenKeys() {
  if (!hasTvKeyInput(capabilities())) return;
  for (const key of KEYS) {
    try {
      window.tizen.tvinputdevice.registerKey(key);
    } catch {
      console.warn('Failed to register Tizen key:', key);
    }
  }
}

export function installBackKey(dispatch) {
  document.addEventListener('tizenhwkey', (e) => {
    if (e.keyName === 'back') {
      e.preventDefault();
      dispatch('back');
    }
  });
}

// The capability boundary is also reachable from this feature module.
export { detectCapabilities } from '../capabilities.js';
export { meetsMinimumPlatform, selectEngine, hasTvKeyInput } from '../lib/capabilities.js';
