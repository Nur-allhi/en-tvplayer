// Shared app state (T-152a, now store-backed in T-170). Every M5 slice imports
// this exact reference; a per-slice copy would break the fast-zap guard and
// boot-resume comparisons. The Proxy from state/ keeps that identity stable.

import { appState } from '../state/index.js';

export { appState };

export const state = appState.get();

// Extra hold after the tagline when no playlist fetch runs (was main.js:314).
// Lives here so the onboarding and startup slices share one value.
export const BOOT_IDLE_HOLD_MS = 1500;
