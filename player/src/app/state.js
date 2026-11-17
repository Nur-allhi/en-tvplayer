// Shared app state, one object (Risk C). Every M5 slice imports this instead
// of owning its own copy of the mutable boot/tune/remote variables — a
// per-slice copy would make the fast-zap guard and boot-resume comparisons
// silently stop working. Extracted in T-152a; behaviour-neutral.
export const state = {
  // T-150 boot timers
  bootTypewriterTimer: null,
  bootShownAt: 0,
  bootTypewriterEnd: 0,

  // T-152a shared app variables
  currentIndex: 0,
  channels: undefined,
  selectedGroup: null,
  bufferingInterval: null,
  bufferingActive: false,
  cleanupListeners: [],
  playbackStarted: false,
  tuneSucceeded: false,
  lastIntent: null,
  tuneSeq: 0,
  pendingUpdate: null,
  onboardFocus: 0,
  progressActive: false,
  lastBackTime: 0,
};

// Extra hold after the tagline when no playlist fetch runs (was main.js:314).
// Lives here so the onboarding and startup slices share one value.
export const BOOT_IDLE_HOLD_MS = 1500;
