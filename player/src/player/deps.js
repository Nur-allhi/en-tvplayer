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
};
