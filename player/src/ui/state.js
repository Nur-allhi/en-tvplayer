// Shared module state for the UI layer (T-130, now store-backed in T-170).
//
// Slices capture `state` at import and mutate `state.x` directly. The state/
// store wraps that exact object in a Proxy, so the identity and array identity
// those writes rely on are unchanged — direct writes simply also notify
// subscribers now. New code may import `uiState` from state/ to subscribe.

import { uiState } from '../state/index.js';

export { uiState };

export const state = uiState.get();
