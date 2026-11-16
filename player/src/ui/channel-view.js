// Channel view helpers (T-135): channel getters, refresh, focus and marquee.
// Calls into core.js go through deps.js, keeping this slice import-free of it.

import { state } from './state.js';
import { deps } from './deps.js';
import { extractGroups, showGroupList, updateSidebarTitle } from './sidebar.js';
import { applyRightSidebar } from './right-menu.js';

export function getChannels() {
  return state.channels;
}

export function getCurrentChannel() {
  if (state.currentIndex >= 0 && state.currentIndex < state.channels.length) {
    return state.channels[state.currentIndex];
  }
  return null;
}

export function refreshChannelList(newChannels) {
  // Preserve the playing mark across playlist refreshes: match by URL
  // (stable across re-fetch/re-sort); resets when the channel is gone.
  const playingUrl =
    state.currentIndex >= 0 && state.currentIndex < state.channels.length && state.channels[state.currentIndex]
      ? state.channels[state.currentIndex].url
      : null;
  state.channels = newChannels;
  state.currentIndex = playingUrl ? newChannels.findIndex((ch) => ch && ch.url === playingUrl) : -1;
  state.focusedIndex = 0;
  extractGroups(state.channels);
  if (state.selectedGroup === 'all') {
    state.sidebarMode = 'channels';
  } else if (state.selectedGroup && !state.groups.find((g) => g.name === state.selectedGroup)) {
    state.selectedGroup = null;
    state.sidebarMode = 'groups';
  } else if (state.groups.length <= 1) {
    state.sidebarMode = 'channels';
    state.selectedGroup = null;
  }
  if (state.sidebarMode === 'groups') {
    showGroupList();
  } else {
    const groupList = document.getElementById('group-list');
    if (groupList) groupList.classList.add('hidden');
    const channelList = document.getElementById('channel-list');
    if (channelList) channelList.classList.remove('hidden');
    deps.renderChannelList();
    updateSidebarTitle();
  }
  updateFocus();
  updateActiveChannel();
  // Close right sidebar since channel list may have changed
  if (state.rightSidebarOpen) {
    state.rightSidebarOpen = false;
    applyRightSidebar();
  }
}

function updateActiveChannel() {
  const items = document.querySelectorAll('.channel-item');
  const displayChannels = deps.getDisplayChannels();
  const playingDisplayIdx = displayChannels.indexOf(state.channels[state.currentIndex]);
  items.forEach((item) => {
    const idx = parseInt(item.dataset.index, 10);
    item.classList.toggle('active', idx === playingDisplayIdx);
  });
}

let marqueeAnimation = null;
let marqueeNameEl = null;

function startMarquee(textEl) {
  stopMarquee();
  const overflow = textEl.scrollWidth - textEl.parentElement.clientWidth;
  if (overflow <= 0) return;
  const offset = overflow + 20;
  marqueeNameEl = textEl;
  textEl.classList.add('marquee');
  marqueeAnimation = textEl.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(0)', offset: 0.15 },
      { transform: 'translateX(-' + offset + 'px)', offset: 0.45 },
      { transform: 'translateX(-' + offset + 'px)', offset: 0.55 },
      { transform: 'translateX(0)', offset: 0.85 },
      { transform: 'translateX(0)' },
    ],
    {
      duration: 4000,
      iterations: Infinity,
    },
  );
}

function stopMarquee() {
  if (marqueeAnimation) {
    marqueeAnimation.cancel();
    marqueeAnimation = null;
  }
  if (marqueeNameEl) {
    marqueeNameEl.classList.remove('marquee');
    marqueeNameEl = null;
  }
}

function updateFocus() {
  stopMarquee();
  const items = document.querySelectorAll('.channel-item');
  items.forEach((item) => {
    const idx = parseInt(item.dataset.index, 10);
    const nowFocused = idx === state.focusedIndex;
    item.classList.toggle('focused', nowFocused);
    if (nowFocused) {
      const textEl = item.querySelector('.channel-name-text');
      if (textEl) {
        requestAnimationFrame(() => startMarquee(textEl));
      }
    }
  });
}

function scrollToFocused() {
  const el = document.querySelector('.channel-item[data-index="' + state.focusedIndex + '"]');
  if (el) {
    // Instant + minimal scroll: see updateGroupFocus.
    el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
}

/* Update badge on the Settings menu button (gentle, non-blocking) */
export function setUpdateBadge(visible) {
  const btn = document.getElementById('settings-btn');
  if (btn) btn.classList.toggle('has-update', !!visible);
}

/* Desktop test relay label (branch-only): Proxy (test): On/Off */
export function setProxyToggleLabel(on) {
  const btn = document.getElementById('proxy-toggle-btn');
  if (btn) btn.textContent = 'Proxy (test): ' + (on ? 'On' : 'Off');
}

// Wire the view helpers other slices call through.
deps.updateActiveChannel = updateActiveChannel;
deps.updateFocus = updateFocus;
deps.scrollToFocused = scrollToFocused;
