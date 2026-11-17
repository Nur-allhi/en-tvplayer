// Feature: Tizen platform compatibility bindings.
//
// Contract (T-172): owns Tizen virtual-key registration and the hardware Back
// key. Exposes registerTizenKeys() and installBackKey(dispatch); the caller
// injects the action dispatcher so this module never imports app/. Both calls
// no-op off Tizen. The pure capability probe stays in lib/capabilities.js.

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
