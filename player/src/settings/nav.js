// Settings navigation (T-140).
import { deps } from './deps.js';
import { state } from './state.js';
import { getSettings } from '../config.js';
import { capabilities } from '../capabilities.js';
import { hasTvKeyInput } from '../lib/capabilities.js';

const onTv = () => hasTvKeyInput(capabilities());

export function navigate(dir) {
  buildFocusOrder();
  const total = state.focusOrder.length;
  if (total === 0) return;

  const navCount = document.querySelectorAll('.nav-item').length;
  const cur = document.querySelector('[data-focused]');
  const curIdx = state.focusOrder.indexOf(cur);
  const inNavZone = curIdx >= 0 && curIdx < navCount;
  const contentStart = navCount; // content follows the nav directly (no back button)
  const hasContent = total > navCount;

  const activeNavIdx = () => {
    const tabs = Array.from(document.querySelectorAll('.nav-item'));
    const activeTab = document.querySelector('.nav-item.active');
    const idx = tabs.indexOf(activeTab);
    return idx >= 0 ? idx : 0;
  };

  if (dir > 0) {
    // DOWN: next item in the same column, wrapping.
    if (inNavZone) {
      state.focusIdx = (curIdx + 1) % navCount;
    } else if (curIdx >= contentStart && hasContent) {
      state.focusIdx = curIdx + 1;
      if (state.focusIdx >= total) state.focusIdx = contentStart;
    } else {
      state.focusIdx = Math.min(total - 1, state.focusIdx + 1);
    }
  } else {
    // UP: previous item in the same column, wrapping.
    if (inNavZone) {
      state.focusIdx = (curIdx - 1 + navCount) % navCount;
    } else if (curIdx >= contentStart && hasContent) {
      if (curIdx === contentStart) {
        state.focusIdx = activeNavIdx(); // back to this section's tab
      } else {
        state.focusIdx = curIdx - 1;
      }
    } else {
      state.focusIdx = Math.max(0, state.focusIdx - 1);
    }
  }

  applyFocus();
}

export function navigateNav(dir) {
  const cur = document.querySelector('[data-focused]');
  if (!cur) return;

  buildFocusOrder();
  const navCount = document.querySelectorAll('.nav-item').length;
  const curIdx = state.focusOrder.indexOf(cur);
  const inNavZone = curIdx >= 0 && curIdx < navCount;
  const contentStart = navCount;
  const total = state.focusOrder.length;

  // Channel Source lays its playlist cards side by side, so Left/Right
  // steps across the row (prev/next focusable) instead of jumping zones.
  // Left from the first card is the escape hatch back to the side nav.
  if (state.activeSection === 'source' && !inNavZone && curIdx >= contentStart) {
    if (dir < 0) {
      if (curIdx === contentStart) {
        const tabs = Array.from(document.querySelectorAll('.nav-item'));
        const activeTab = document.querySelector('.nav-item.active');
        const idx = tabs.indexOf(activeTab);
        state.focusIdx = idx >= 0 ? idx : 0;
      } else {
        state.focusIdx = curIdx - 1;
      }
      applyFocus();
      return;
    }
    state.focusIdx = curIdx + 1 >= total ? contentStart : curIdx + 1;
    applyFocus();
    return;
  }

  const btnGroup = cur.closest('.btn-group');
  if (btnGroup) {
    const buttons = Array.from(btnGroup.querySelectorAll('.btn'));
    const btnIdx = buttons.indexOf(cur);
    if (btnIdx >= 0) {
      if (dir > 0 && btnIdx < buttons.length - 1) {
        const newIdx = state.focusOrder.indexOf(buttons[btnIdx + 1]);
        if (newIdx >= 0) {
          state.focusIdx = newIdx;
          applyFocus();
        }
        return;
      } else if (dir < 0 && btnIdx > 0) {
        const newIdx = state.focusOrder.indexOf(buttons[btnIdx - 1]);
        if (newIdx >= 0) {
          state.focusIdx = newIdx;
          applyFocus();
        }
        return;
      }
      if (dir < 0 && btnIdx === 0) {
        const tabs = Array.from(document.querySelectorAll('.nav-item'));
        const activeTab = document.querySelector('.nav-item.active');
        const idx = tabs.indexOf(activeTab);
        state.focusIdx = idx >= 0 ? idx : 0;
        applyFocus();
        return;
      }
      return;
    }
  }

  if (dir > 0) {
    if (inNavZone) {
      state.focusIdx = contentStart;
      applyFocus();
    }
  } else {
    if (curIdx >= contentStart) {
      const tabs = Array.from(document.querySelectorAll('.nav-item'));
      const activeTab = document.querySelector('.nav-item.active');
      const idx = tabs.indexOf(activeTab);
      state.focusIdx = idx >= 0 ? idx : 0;
      applyFocus();
    }
  }
}

function moveSettingsFocus(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  buildFocusOrder();
  const idx = state.focusOrder.indexOf(target);
  if (idx >= 0) {
    state.focusIdx = idx;
    applyFocus();
  }
}

function buildFocusOrder() {
  state.focusOrder = [];
  document.querySelectorAll('.nav-item').forEach((el) => state.focusOrder.push(el));

  if (state.activeSection === 'source') {
    if (state.addMode) {
      state.focusOrder.push(document.getElementById('pl-add-type-m3u'));
      state.focusOrder.push(document.getElementById('pl-add-type-xtream'));
      if (state.addType === 'xtream') {
        state.focusOrder.push(document.getElementById('pl-add-host'));
        state.focusOrder.push(document.getElementById('pl-add-user'));
        state.focusOrder.push(document.getElementById('pl-add-pass'));
        state.focusOrder.push(document.getElementById('pl-add-test'));
      } else {
        state.focusOrder.push(document.getElementById('pl-add-url'));
      }
      state.focusOrder.push(document.getElementById('pl-add-name'));
      state.focusOrder.push(document.getElementById('pl-add-save'));
      state.focusOrder.push(document.getElementById('pl-add-cancel'));
    } else if (state.editMode && state.editIndex >= 0) {
      state.focusOrder.push(document.getElementById('pl-edit-type-m3u'));
      state.focusOrder.push(document.getElementById('pl-edit-type-xtream'));
      if (state.editType === 'xtream') {
        state.focusOrder.push(document.getElementById('pl-edit-host'));
        state.focusOrder.push(document.getElementById('pl-edit-user'));
        state.focusOrder.push(document.getElementById('pl-edit-pass'));
        state.focusOrder.push(document.getElementById('pl-edit-test'));
      } else {
        state.focusOrder.push(document.getElementById('pl-edit-url'));
      }
      state.focusOrder.push(document.getElementById('pl-edit-name'));
      state.focusOrder.push(document.getElementById('pl-edit-save'));
      state.focusOrder.push(document.getElementById('pl-edit-cancel'));
    } else {
      const s = getSettings();
      for (let i = 0; i < s.playlists.length; i++) {
        const entry = document.getElementById('playlist-entry-' + i);
        if (entry) state.focusOrder.push(entry);
        const editBtn = document.getElementById('pl-edit-' + i);
        if (editBtn) state.focusOrder.push(editBtn);
        const deleteBtn = document.getElementById('pl-delete-' + i);
        if (deleteBtn) state.focusOrder.push(deleteBtn);
      }
      const addBtn = document.getElementById('pl-add-btn');
      if (addBtn) state.focusOrder.push(addBtn);
      state.focusOrder.push(document.getElementById('settings-fetch-btn'));
    }
  } else if (state.activeSection === 'playback') {
    state.focusOrder.push(document.getElementById('toggle-autoq'));
    state.focusOrder.push(document.getElementById('toggle-auto-refresh'));
    state.focusOrder.push(document.getElementById('toggle-update-check'));
    state.focusOrder.push(document.getElementById('toggle-watermark'));
    state.focusOrder.push(document.getElementById('toggle-badge'));
    state.focusOrder.push(document.getElementById('toggle-proxymenu'));
    state.focusOrder.push(document.getElementById('toggle-channelsort'));
    const gn = deps.groupNames();
    for (let i = 0; i < gn.length; i++) {
      state.focusOrder.push(document.getElementById('show-group-' + i));
    }
  } else if (state.activeSection === 'about') {
    state.focusOrder.push(document.getElementById('about-copy-diagnostics'));
    state.focusOrder.push(document.getElementById('vod-add-url'));
    state.focusOrder.push(document.getElementById('vod-add-btn'));
  }
}

function clearFocus() {
  document.querySelectorAll('[data-focused]').forEach((el) => el.removeAttribute('data-focused'));
}

function applyFocus() {
  clearFocus();
  // Stale IME-engage flags die on every focus move — the next OK re-opens
  // the keyboard instead of acting on a field the user already left.
  document.querySelectorAll('input[data-ime]').forEach((i) => i.removeAttribute('data-ime'));
  buildFocusOrder();
  if (state.focusIdx >= 0 && state.focusIdx < state.focusOrder.length) {
    const el = state.focusOrder[state.focusIdx];
    if (el) {
      el.setAttribute('data-focused', '');
      el.scrollIntoView({ block: 'nearest' });
      const activeEl = document.activeElement;
      const elIsField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
      // Desktop focuses fields on arrival so typing works at once. On Tizen
      // the keyboard must open only after OK on the field (selectFocused),
      // never while merely passing through it.
      if (elIsField && !onTv()) {
        el.focus();
      } else if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl !== el) {
        activeEl.blur();
      }
    }
  }
}

Object.assign(deps, { moveSettingsFocus, buildFocusOrder, clearFocus, applyFocus });
