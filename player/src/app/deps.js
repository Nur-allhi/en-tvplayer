// Cross-slice function registry for the M5 app split (T-152a). Pure module:
// no imports, no DOM at import time. Each planned app slice calls through a
// slot instead of importing a sibling slice, which is what breaks the
// init -> registerTizenKeys -> handleRemoteAction -> startPlayer -> init
// cycle (T-150b/T-151). An unwired slot throws loudly so a missed
// registration in the hub (T-152c) can never silently degrade boot or remote
// input. No implementations are registered here — app/index.js wires them.

function unwired(name) {
  return () => {
    throw new Error(`app deps: ${name} was called before it was wired`);
  };
}

export const deps = {
  // Boot splash (app/boot.js) — started before any slice exists.
  showBootSplash: unwired('showBootSplash'),
  hideBootSplash: unwired('hideBootSplash'),

  // Onboarding (app/onboarding.js, T-152b).
  showFirstRun: unwired('showFirstRun'),
  showOnboarding: unwired('showOnboarding'),
  hideOnboarding: unwired('hideOnboarding'),
  updateOnboardFocus: unwired('updateOnboardFocus'),
  selectOnboarding: unwired('selectOnboarding'),
  isOnboardingOpen: unwired('isOnboardingOpen'),

  // What's New (app/whats-new.js, T-152b).
  checkWhatsNew: unwired('checkWhatsNew'),
  showWhatsNew: unwired('showWhatsNew'),
  closeWhatsNew: unwired('closeWhatsNew'),
  markVersionSeen: unwired('markVersionSeen'),
  isWhatsNewOpen: unwired('isWhatsNewOpen'),
  hideBootSplashAndMaybeWhatsNew: unwired('hideBootSplashAndMaybeWhatsNew'),

  // Startup (app/start.js, T-152c).
  init: unwired('init'),
  startPlayer: unwired('startPlayer'),
  restoreLastSession: unwired('restoreLastSession'),
  scheduleUpdateCheck: unwired('scheduleUpdateCheck'),
  showEmptyState: unwired('showEmptyState'),

  // Remote input (app/remote.js, T-151).
  handleRemoteAction: unwired('handleRemoteAction'),
  registerTizenKeys: unwired('registerTizenKeys'),
  zapChannel: unwired('zapChannel'),

  // Channel + shared UI helpers (app/channels.js / hub). These are the other
  // half of the remote/start cycles: handleRemoteAction reaches showPlayer and
  // startPlayer reaches handleChannelSelect, so neither can be imported.
  handleChannelSelect: unwired('handleChannelSelect'),
  refreshChannels: unwired('refreshChannels'),
  refreshChannelsInBackground: unwired('refreshChannelsInBackground'),
  applyFreshChannels: unwired('applyFreshChannels'),
  handleStaleToken: unwired('handleStaleToken'),
  showStaleCacheNotice: unwired('showStaleCacheNotice'),
  sortChannels: unwired('sortChannels'),
  updateResolutionBadge: unwired('updateResolutionBadge'),
  getDisplayChannels: unwired('getDisplayChannels'),
  refreshProxyMenu: unwired('refreshProxyMenu'),
  showPlayer: unwired('showPlayer'),
  showSettingsPage: unwired('showSettingsPage'),
  showMediaAdd: unwired('showMediaAdd'),
  showProgress: unwired('showProgress'),
  hideProgress: unwired('hideProgress'),
  updateProgressPercent: unwired('updateProgressPercent'),
  forcePaint: unwired('forcePaint'),
};
