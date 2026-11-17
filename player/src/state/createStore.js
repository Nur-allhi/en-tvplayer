// Pure reactive store (T-170). DOM-free and side-effect free at construction.
//
// The v4 slices captured `state` at import and mutated `state.x` directly. A
// Proxy keeps that exact object identity, so those writes still work and also
// notify subscribers. Nested objects and arrays are shared, never cloned, so
// collection identity survives. `set(patch)` merges in place and emits exactly
// one notification, even for an empty patch.

export function createStore(initial = {}) {
  const listeners = new Set();
  let version = 0;
  let batching = false;

  const notify = () => {
    version += 1;
    // Snapshot so a subscriber added (or removed) mid-dispatch cannot change
    // the current round of notifications.
    for (const listener of [...listeners]) listener(state, version);
  };

  // Shallow copy: the caller keeps ownership of its initial object.
  const target = { ...initial };
  const state = new Proxy(target, {
    set(obj, key, value) {
      if (Object.is(obj[key], value)) return true;
      obj[key] = value;
      if (!batching) notify();
      return true;
    },
  });

  const set = (patch) => {
    batching = true;
    try {
      // Write to the raw target so a multi-key patch emits one notification.
      Object.assign(target, patch);
    } finally {
      batching = false;
    }
    notify();
  };

  const subscribe = (listener) => {
    if (typeof listener !== 'function') throw new TypeError('store subscriber must be a function');
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    get: () => state,
    set,
    subscribe,
    // Aliases used by the direct-mutation tests in this slice.
    getState: () => state,
    setState: set,
    getVersion: () => version,
  };
}
