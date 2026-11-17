// Cross-slice function registry for the M2 player split (T-124). Pure module:
// no imports, no DOM at import time. The hub registers concrete implementations
// at boot; every slice calls through a slot instead of importing the hub back,
// which is what turns the init -> handleError -> load -> init cycle into a
// one-way wire-up. An unwired slot throws loudly so a missed registration can
// never silently degrade playback.

function unwired(name) {
  return () => {
    throw new Error(`player deps: ${name} was called before it was wired`);
  };
}

export const deps = {
  loadChannel: unwired('loadChannel'),
  initPlayer: unwired('initPlayer'),
  handlePlayerError: unwired('handlePlayerError'),
  scheduleReconnect: unwired('scheduleReconnect'),
  showError: unwired('showError'),
  logEvent: unwired('logEvent'),
  getErrorMessage: unwired('getErrorMessage'),
  giveUpTune: unwired('giveUpTune'),
  probeChannelFormat: unwired('probeChannelFormat'),
  startStallWatchdog: unwired('startStallWatchdog'),
  stopStallWatchdog: unwired('stopStallWatchdog'),
  startBlackWatchdog: unwired('startBlackWatchdog'),
  stopBlackWatchdog: unwired('stopBlackWatchdog'),
  notifyBufferingProgress: unwired('notifyBufferingProgress'),
  isRenderingFrames: unwired('isRenderingFrames'),
  // T-126: the init slice's calls back into the hub. Without slots these would
  // be imports of player.js from init.js — the cycle the registry exists to break.
  showLoading: unwired('showLoading'),
  getBufferingPercent: unwired('getBufferingPercent'),
  showPlayState: unwired('showPlayState'),
  toProxied: unwired('toProxied'),
  destroyPlayer: unwired('destroyPlayer'),
  // T-127 additions (load slice calls back into the hub). Note destroyPlayer
  // is NOT a slot: load.js imports it directly from init.js, which does not
  // import load.js, so that edge cannot form a cycle.
  isProxyEnabledFor: unwired('isProxyEnabledFor'),
  notifyTuneAttempt: unwired('notifyTuneAttempt'),
  showTuneElapsed: unwired('showTuneElapsed'),
  tryResumeVideo: unwired('tryResumeVideo'),
  hideError: unwired('hideError'),
  loadViaAvplay: unwired('loadViaAvplay'),
  switchToAvplay: unwired('switchToAvplay'),
  shouldTryNative: unwired('shouldTryNative'),
  reloadChannel: unwired('reloadChannel'),
  scheduleForbiddenReload: unwired('scheduleForbiddenReload'),
  showTerminal: unwired('showTerminal'),
};
