// Shared module state for the playback engine (T-129, docs/MIGRATION.md Risk C).
//
// `player.js` is about to be sliced into `player/init.js`, `player/load.js`,
// `player/recovery.js`, `player/stream.js` and `player/events.js`. Every one of
// those slices reads and writes the same 45 variables below. If each slice kept
// its own copy, the engine would still compile and still start — and would
// silently stop recovering, or stop noticing the channel changed.
//
// So the state lives here, in one object, and every slice imports this exact
// reference. A property counts as shared precisely when more than one slice
// will need it; anything that genuinely belongs to one slice stays a module
// local there.
//
// Deliberately NOT a reactive store. That is T-170 in a later phase, kept
// separate so a future failure has one cause. Using a plain object with
// property mutation (never destructuring a snapshot) is what keeps this a
// behaviour-identical move.

export const state = {
  // ── Engine and DOM handles ────────────────────────────────────────────
  player: null,
  videoElement: null,

  // ── Subscriptions registered by the caller ────────────────────────────
  bufferingCallback: null,
  trackCallback: null,
  channelAdvanceCallback: null,
  tuneAttemptCallback: null,
  tokenExpiredCallback: null,

  // ── Current tune ──────────────────────────────────────────────────────
  isBuffering: false,
  currentChannel: null,
  // Bumped on every load; a stale async continuation compares against it and
  // bails. This is the app's main guard against two tunes racing.
  loadToken: 0,

  // ── Reconnect (soft, transient blips) ─────────────────────────────────
  reconnectTimer: null,
  reconnectPending: false,
  reconnectAttempts: 0,
  consecutiveErrors: 0,

  // Per-tune hard-reload count (stall-watchdog + consecutive-error reloads).
  // Budgeted by hardReloadDecision(): endless destroy/create loops pile hung
  // players and MSE buffers until the TV kills the app.
  hardReloads: 0,

  // Silent-retry ordinal for the status line (1 = first try, no suffix shown).
  tuneAttempt: 1,

  // ── Stall watchdog ────────────────────────────────────────────────────
  stallWatchdogTimer: null,
  lastStallTime: 0,
  lastStallCheck: 0,
  // Consecutive frozen-with-live-network deferrals (bounded by
  // stallPatienceExceeded so a starved stream still escalates).
  stallDeferrals: 0,
  lastResortAttempts: 0,
  advancePending: false,
  // Pause intent: the stall watchdog must tell a user pause (leave alone)
  // apart from a stale teardown pausing the video behind our back (resume).
  userPaused: false,

  // ── Load timing ───────────────────────────────────────────────────────
  loadingTimeout: null,
  stalledTimer: null,
  lastShakaActivity: 0,
  lastShakaReq: '',
  lastShakaResp: '',
  lastAdaptationAt: 0,

  // ── Staged loading UX ─────────────────────────────────────────────────
  // While the initial manifest load is pending, the center spinner owns the
  // screen and buffering events are held back. Once load() resolves, the
  // first frame is up — only then does the buffering pill take over.
  initialLoadPending: false,

  // ── Live-segment-404 budget ───────────────────────────────────────────
  // Keyed by URL with a 5-minute window: an incident burst gets 3 edge
  // re-syncs, then the link is condemned. Deliberately NOT reset in
  // loadChannel(): the reloads must share one budget or they loop forever.
  segment404Url: null,
  segment404Attempts: 0,
  segment404LastAt: 0,

  // ── Native fallback (BUG-020) ─────────────────────────────────────────
  // Some streams (interlaced MBAFF H264, …) transmux fine but the browser
  // decoder paints zero frames — buffering completes, screen stays black, no
  // Shaka error. Those play natively.
  //
  // `useAvplay` is RUNTIME STATE (this channel is on the native path), not a
  // platform capability. The probe in `capabilities.js` answers what the
  // platform can do; do not collapse the two (T-115).
  useAvplay: false,
  blackWatchTimer: null,
  avplayPreferredUrls: new Set(),
  avplayFailedUrls: new Set(),
  avplayPaused: false,
  avplayBufferPercent: 0,

  // ── Per-URL workarounds (each cached so it is tried once) ─────────────
  // BUG-013: HLS with EXT-X-PROGRAM-DATE-TIME tags crashes Shaka (upstream
  // #5014). These URLs are retried once with PDT sync disabled.
  pdtFallbackUrls: new Set(),
  // BUG-014: URLs Shaka could not identify (error 4000). The format is probed
  // from the first bytes and cached per URL so the retry passes the hint.
  sniffedMimeUrls: new Map(),
  sniffTriedUrls: new Set(),
  // In-flight format probe, aborted when the user tunes away mid-probe.
  probeController: null,

  // ── Video element error counters ──────────────────────────────────────
  videoErrorCount: 0,
  lastVideoErrorTime: 0,
};
