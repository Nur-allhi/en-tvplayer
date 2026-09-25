import { getSettings, saveSettings, getActivePlaylist, APP_VERSION } from './config.js';
import { fetchPlaylistEntry, escapeHtml } from './utils.js';
import { login as xtreamLogin } from './xtream.js';
import { setConsented } from './update.js';
import * as player from './player.js';
import * as ui from './ui.js';

let container = null;
let onPlaylistFetched = null;
let onClose = null;
let onRender = null;
let editIndex = -1;
let activeSection = 'source';
let focusIdx = 0;
let focusOrder = [];
let addMode = false;
let editMode = false;
// Playlist form type: 'm3u' (URL) or 'xtream' (host + credentials).
let addType = 'm3u';
let editType = 'm3u';

const NAV_ITEMS = [
  { id: 'source', icon: '📡', label: 'Channel Source' },
  { id: 'playback', icon: '▶', label: 'Playback' },
  { id: 'about', icon: 'ℹ', label: 'About' },
];

// Max saved playlists (was 8 — capped at 3 to keep the source card compact).
const MAX_PLAYLISTS = 3;

// Tizen TVs don't open the IME on programmatic focus — the keyboard only
// appears on an explicit user gesture, so the first OK re-focuses the field
// (blur + focus) to pop the keyboard. Desktop keeps the old advance-on-Enter.
const isTizenTV = typeof window !== 'undefined' && !!(window.tizen && window.tizen.tvinputdevice);

export function init(settingsContainer, callbacks) {
  container = settingsContainer;
  onPlaylistFetched = callbacks.onPlaylistFetched;
  onClose = callbacks.onClose;
  onRender = callbacks.onRender;
}

export function show() {
  if (!container) return;
  editIndex = -1;
  addMode = false;
  editMode = false;
  activeSection = 'source';
  focusIdx = 0;
  container.classList.remove('hidden');
  render();
  applyFocus();
}

// Opens Settings → Source with the add form showing, preset to the given
// type ('m3u' or 'xtream'). Used by the first-run source picker.
export function openAddForm(type) {
  if (!container) return;
  activeSection = 'source';
  addMode = true;
  editMode = false;
  editIndex = -1;
  addType = type === 'xtream' ? 'xtream' : 'm3u';
  focusIdx = 0;
  container.classList.remove('hidden');
  render();
  applyFocus();
}

export function hide() {
  if (!container) return;
  container.classList.add('hidden');
}

export function isVisible() {
  return container && !container.classList.contains('hidden');
}

export function navigate(dir) {
  buildFocusOrder();
  const total = focusOrder.length;
  if (total === 0) return;

  const navCount = document.querySelectorAll('.nav-item').length;
  const cur = document.querySelector('[data-focused]');
  const curIdx = focusOrder.indexOf(cur);
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
      focusIdx = (curIdx + 1) % navCount;
    } else if (curIdx >= contentStart && hasContent) {
      focusIdx = curIdx + 1;
      if (focusIdx >= total) focusIdx = contentStart;
    } else {
      focusIdx = Math.min(total - 1, focusIdx + 1);
    }
  } else {
    // UP: previous item in the same column, wrapping.
    if (inNavZone) {
      focusIdx = (curIdx - 1 + navCount) % navCount;
    } else if (curIdx >= contentStart && hasContent) {
      if (curIdx === contentStart) {
        focusIdx = activeNavIdx(); // back to this section's tab
      } else {
        focusIdx = curIdx - 1;
      }
    } else {
      focusIdx = Math.max(0, focusIdx - 1);
    }
  }

  applyFocus();
}

export function navigateNav(dir) {
  const cur = document.querySelector('[data-focused]');
  if (!cur) return;

  buildFocusOrder();
  const navCount = document.querySelectorAll('.nav-item').length;
  const curIdx = focusOrder.indexOf(cur);
  const inNavZone = curIdx >= 0 && curIdx < navCount;
  const contentStart = navCount;
  const total = focusOrder.length;

  // Channel Source lays its playlist cards side by side, so Left/Right
  // steps across the row (prev/next focusable) instead of jumping zones.
  // Left from the first card is the escape hatch back to the side nav.
  if (activeSection === 'source' && !inNavZone && curIdx >= contentStart) {
    if (dir < 0) {
      if (curIdx === contentStart) {
        const tabs = Array.from(document.querySelectorAll('.nav-item'));
        const activeTab = document.querySelector('.nav-item.active');
        const idx = tabs.indexOf(activeTab);
        focusIdx = idx >= 0 ? idx : 0;
      } else {
        focusIdx = curIdx - 1;
      }
      applyFocus();
      return;
    }
    focusIdx = curIdx + 1 >= total ? contentStart : curIdx + 1;
    applyFocus();
    return;
  }

  const btnGroup = cur.closest('.btn-group');
  if (btnGroup) {
    const buttons = Array.from(btnGroup.querySelectorAll('.btn'));
    const btnIdx = buttons.indexOf(cur);
    if (btnIdx >= 0) {
      if (dir > 0 && btnIdx < buttons.length - 1) {
        const newIdx = focusOrder.indexOf(buttons[btnIdx + 1]);
        if (newIdx >= 0) { focusIdx = newIdx; applyFocus(); }
        return;
      } else if (dir < 0 && btnIdx > 0) {
        const newIdx = focusOrder.indexOf(buttons[btnIdx - 1]);
        if (newIdx >= 0) { focusIdx = newIdx; applyFocus(); }
        return;
      }
      if (dir < 0 && btnIdx === 0) {
        const tabs = Array.from(document.querySelectorAll('.nav-item'));
        const activeTab = document.querySelector('.nav-item.active');
        const idx = tabs.indexOf(activeTab);
        focusIdx = idx >= 0 ? idx : 0;
        applyFocus();
        return;
      }
      return;
    }
  }

  if (dir > 0) {
    if (inNavZone) {
      focusIdx = contentStart;
      applyFocus();
    }
  } else {
    if (curIdx >= contentStart) {
      const tabs = Array.from(document.querySelectorAll('.nav-item'));
      const activeTab = document.querySelector('.nav-item.active');
      const idx = tabs.indexOf(activeTab);
      focusIdx = idx >= 0 ? idx : 0;
      applyFocus();
    }
  }
}

export function selectFocused() {
  const el = document.querySelector('[data-focused]');
  if (!el) return;

  if (el.classList.contains('nav-item')) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    activeSection = el.dataset.section;
    focusIdx = 0;
    render();
    applyFocus();
    return;
  }

  if (el.classList.contains('toggle')) {
    // Trigger the click handler registered in render() — it saves the setting
    // and applies it to the player. (classList.toggle alone never persisted.)
    el.click();
    return;
  }

  if (el.tagName === 'INPUT') {
    // On Tizen the first OK hands focus to the IME so the TV keyboard
    // opens; the second OK advances/saves. Desktop keeps advance-on-Enter.
    if (isTizenTV && !el.dataset.ime) {
      el.dataset.ime = '1';
      try { el.blur(); } catch {}
      el.focus();
      return;
    }
    delete el.dataset.ime;
    // On TV the remote layer intercepts Enter/OK and routes it here, so the
    // desktop-only keydown Enter handlers never run. Make OK inside a text
    // field act like pressing Enter on a desktop form: advance to the next
    // field, or save from the last field (playlist URL).
    if (el.id === 'pl-add-name') {
      moveSettingsFocus(addType === 'xtream' ? 'pl-add-host' : 'pl-add-url');
    } else if (el.id === 'pl-add-url') {
      saveAddPlaylist();
    } else if (el.id === 'pl-add-host') {
      moveSettingsFocus('pl-add-user');
    } else if (el.id === 'pl-add-user') {
      moveSettingsFocus('pl-add-pass');
    } else if (el.id === 'pl-add-pass') {
      saveAddPlaylist();
    } else if (el.id === 'pl-edit-name') {
      moveSettingsFocus(editType === 'xtream' ? 'pl-edit-host' : 'pl-edit-url');
    } else if (el.id === 'pl-edit-url') {
      saveEditPlaylist();
    } else if (el.id === 'pl-edit-host') {
      moveSettingsFocus('pl-edit-user');
    } else if (el.id === 'pl-edit-user') {
      moveSettingsFocus('pl-edit-pass');
    } else if (el.id === 'pl-edit-pass') {
      saveEditPlaylist();
    } else {
      el.focus();
    }
    return;
  }

  if (el.id === 'pl-add-btn') {
    addMode = true;
    addType = 'm3u';
    render();
    applyFocus();
    return;
  }

  // NOTE: only match per-row buttons like "pl-edit-0". The edit form's
  // "pl-edit-save"/"pl-edit-cancel" buttons start with the same prefix and
  // used to be swallowed here, so editing a playlist never saved.
  if (el.id && /^pl-edit-\d+$/.test(el.id)) {
    const idx = parseInt(el.id.split('-')[2], 10);
    const entry = getSettings().playlists[idx];
    editMode = true;
    editIndex = idx;
    editType = entry && entry.type === 'xtream' ? 'xtream' : 'm3u';
    render();
    applyFocus();
    return;
  }

  if (el.id && /^pl-delete-\d+$/.test(el.id)) {
    const idx = parseInt(el.id.split('-')[2], 10);
    const p = getSettings().playlists[idx];
    const name = p ? p.name : 'this playlist';
    ui.showConfirmDialog(`Delete "${name}"?`, (confirmed) => {
      if (!confirmed) return;
      const playlists = getSettings().playlists.filter((_, j) => j !== idx);
      let active = getSettings().activePlaylistIndex;
      if (active >= playlists.length) active = playlists.length - 1;
      if (active < 0) active = -1;
      saveSettings({ playlists, activePlaylistIndex: active });
      render();
      applyFocus();
    });
    return;
  }

  if (el.id === 'pl-add-type-m3u') {
    setFormType('pl-add', 'm3u');
    return;
  }

  if (el.id === 'pl-add-type-xtream') {
    setFormType('pl-add', 'xtream');
    return;
  }

  if (el.id === 'pl-add-test') {
    testXtreamLogin('pl-add');
    return;
  }

  if (el.id === 'pl-edit-type-m3u') {
    setFormType('pl-edit', 'm3u');
    return;
  }

  if (el.id === 'pl-edit-type-xtream') {
    setFormType('pl-edit', 'xtream');
    return;
  }

  if (el.id === 'pl-edit-test') {
    testXtreamLogin('pl-edit');
    return;
  }

  if (el.id === 'pl-add-save') {
    saveAddPlaylist();
    return;
  }

  if (el.id === 'pl-add-cancel') {
    addMode = false;
    render();
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      activeEl.blur();
    }
    document.body.focus();
    focusIdx = 0;
    applyFocus();
    return;
  }

  if (el.id === 'pl-edit-save') {
    saveEditPlaylist();
    return;
  }

  if (el.id === 'pl-edit-cancel') {
    editMode = false;
    editIndex = -1;
    render();
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      activeEl.blur();
    }
    document.body.focus();
    focusIdx = 0;
    applyFocus();
    return;
  }

  // OK on a playlist card selects that source AND loads it into the app
  // (same path as the Active button). Mouse click stays select-only.
  if (el.classList.contains('playlist-entry') && el.id && /^playlist-entry-\d+$/.test(el.id)) {
    const idx = parseInt(el.id.split('-')[2], 10);
    const s = getSettings();
    if (idx >= 0 && idx < s.playlists.length && !(editMode && editIndex === idx)) {
      saveSettings({ activePlaylistIndex: idx });
      render();
      applyFocus();
      handleFetch();
    }
    return;
  }

  if (el.classList.contains('btn') || el.classList.contains('playlist-entry')) {
    el.click();
    return;
  }
}

// Move focus to another element by id through the normal focus-order machinery.
// Used to make Enter/OK advance from the name field to the URL field.
function moveSettingsFocus(targetId) {
  const target = document.getElementById(targetId);
  if (!target) return;
  buildFocusOrder();
  const idx = focusOrder.indexOf(target);
  if (idx >= 0) {
    focusIdx = idx;
    applyFocus();
  }
}

function saveAddPlaylist() {
  const nameEl = document.getElementById('pl-add-name');
  const name = nameEl ? nameEl.value.trim() : '';
  const settings = getSettings();
  if (settings.playlists.length >= MAX_PLAYLISTS) return;
  const playlists = settings.playlists;
  const base = { name: name || 'Unnamed', addedAt: new Date().toISOString(), lastPlayedAt: null };
  if (addType === 'xtream') {
    const host = valOf('pl-add-host');
    const username = valOf('pl-add-user');
    const password = document.getElementById('pl-add-pass') ? document.getElementById('pl-add-pass').value : '';
    if (!host || !username || !password) return;
    playlists.push({ ...base, type: 'xtream', host, username, password, url: host });
  } else {
    const url = valOf('pl-add-url');
    if (!url) return;
    playlists.push({ ...base, type: 'm3u', url });
  }
  saveSettings({ playlists, activePlaylistIndex: playlists.length - 1 });
  addMode = false;
  render();
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    activeEl.blur();
  }
  document.body.focus();
  focusIdx = 0;
  applyFocus();
}

function valOf(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function saveEditPlaylist() {
  const nameEl = document.getElementById('pl-edit-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (editIndex < 0) return;
  const playlists = getSettings().playlists;
  if (editType === 'xtream') {
    const host = valOf('pl-edit-host');
    const username = valOf('pl-edit-user');
    const password = document.getElementById('pl-edit-pass') ? document.getElementById('pl-edit-pass').value : '';
    if (!host || !username || !password) return;
    playlists[editIndex] = { ...playlists[editIndex], name: name || 'Unnamed', type: 'xtream', host, username, password, url: host };
  } else {
    const url = valOf('pl-edit-url');
    if (!url) return;
    playlists[editIndex] = { ...playlists[editIndex], name: name || 'Unnamed', type: 'm3u', url };
  }
  saveSettings({ playlists });
  editMode = false;
  editIndex = -1;
  render();
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    activeEl.blur();
  }
  document.body.focus();
  focusIdx = 0;
  applyFocus();
}

// Switches the add/edit form between M3U URL and Xtream login fields
// without re-rendering (typed values survive).
function setFormType(prefix, type) {
  if (prefix === 'pl-add') addType = type;
  else editType = type;
  const m3u = document.getElementById(prefix + '-m3u-fields');
  const xt = document.getElementById(prefix + '-xtream-fields');
  if (m3u) m3u.classList.toggle('hidden', type !== 'm3u');
  if (xt) xt.classList.toggle('hidden', type !== 'xtream');
  const m3uBtn = document.getElementById(prefix + '-type-m3u');
  const xtBtn = document.getElementById(prefix + '-type-xtream');
  if (m3uBtn) m3uBtn.classList.toggle('active', type === 'm3u');
  if (xtBtn) xtBtn.classList.toggle('active', type === 'xtream');
  moveSettingsFocus(prefix + (type === 'm3u' ? '-url' : '-host'));
}

// Tests Xtream credentials, reporting plainly in the form status line.
async function testXtreamLogin(prefix) {
  const statusEl = document.getElementById(prefix + '-test-status');
  const host = valOf(prefix + '-host');
  const username = valOf(prefix + '-user');
  const passEl = document.getElementById(prefix + '-pass');
  const password = passEl ? passEl.value : '';
  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.textContent = 'Checking...';
  }
  try {
    await xtreamLogin({ host, username, password });
    if (statusEl) statusEl.textContent = 'Login OK — save to load channels';
  } catch (e) {
    if (statusEl) statusEl.textContent = e.message;
  }
}

function buildFocusOrder() {
  focusOrder = [];
  document.querySelectorAll('.nav-item').forEach(el => focusOrder.push(el));

  if (activeSection === 'source') {
    if (addMode) {
      focusOrder.push(document.getElementById('pl-add-name'));
      focusOrder.push(document.getElementById('pl-add-type-m3u'));
      focusOrder.push(document.getElementById('pl-add-type-xtream'));
      if (addType === 'xtream') {
        focusOrder.push(document.getElementById('pl-add-host'));
        focusOrder.push(document.getElementById('pl-add-user'));
        focusOrder.push(document.getElementById('pl-add-pass'));
        focusOrder.push(document.getElementById('pl-add-test'));
      } else {
        focusOrder.push(document.getElementById('pl-add-url'));
      }
      focusOrder.push(document.getElementById('pl-add-save'));
      focusOrder.push(document.getElementById('pl-add-cancel'));
    } else if (editMode && editIndex >= 0) {
      focusOrder.push(document.getElementById('pl-edit-name'));
      focusOrder.push(document.getElementById('pl-edit-type-m3u'));
      focusOrder.push(document.getElementById('pl-edit-type-xtream'));
      if (editType === 'xtream') {
        focusOrder.push(document.getElementById('pl-edit-host'));
        focusOrder.push(document.getElementById('pl-edit-user'));
        focusOrder.push(document.getElementById('pl-edit-pass'));
        focusOrder.push(document.getElementById('pl-edit-test'));
      } else {
        focusOrder.push(document.getElementById('pl-edit-url'));
      }
      focusOrder.push(document.getElementById('pl-edit-save'));
      focusOrder.push(document.getElementById('pl-edit-cancel'));
    } else {
      const s = getSettings();
      for (let i = 0; i < s.playlists.length; i++) {
        const entry = document.getElementById('playlist-entry-' + i);
        if (entry) focusOrder.push(entry);
        const editBtn = document.getElementById('pl-edit-' + i);
        if (editBtn) focusOrder.push(editBtn);
        const deleteBtn = document.getElementById('pl-delete-' + i);
        if (deleteBtn) focusOrder.push(deleteBtn);
      }
      const addBtn = document.getElementById('pl-add-btn');
      if (addBtn) focusOrder.push(addBtn);
      focusOrder.push(document.getElementById('settings-fetch-btn'));
    }
  } else if (activeSection === 'playback') {
    focusOrder.push(document.getElementById('toggle-autoq'));
    focusOrder.push(document.getElementById('toggle-auto-refresh'));
    focusOrder.push(document.getElementById('toggle-update-check'));
    focusOrder.push(document.getElementById('toggle-watermark'));
    focusOrder.push(document.getElementById('toggle-badge'));
    focusOrder.push(document.getElementById('toggle-proxymenu'));
    focusOrder.push(document.getElementById('toggle-channelsort'));
    const gn = groupNames();
    for (let i = 0; i < gn.length; i++) {
      focusOrder.push(document.getElementById('show-group-' + i));
    }
  }
}

function clearFocus() {
  document.querySelectorAll('[data-focused]').forEach(el => el.removeAttribute('data-focused'));
}

function applyFocus() {
  clearFocus();
  // Stale IME-engage flags die on every focus move — the next OK re-opens
  // the keyboard instead of acting on a field the user already left.
  document.querySelectorAll('input[data-ime]').forEach((i) => i.removeAttribute('data-ime'));
  buildFocusOrder();
  if (focusIdx >= 0 && focusIdx < focusOrder.length) {
    const el = focusOrder[focusIdx];
    if (el) {
      el.setAttribute('data-focused', '');
      el.scrollIntoView({ block: 'nearest' });
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.focus();
      } else {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          activeEl.blur();
        }
      }
    }
  }
}

function render() {
  const s = getSettings();
  const lastFetched = s.channelsFetched ? timeAgo(s.channelsFetched) : 'Never';

  const navHtml = NAV_ITEMS.map(item =>
    '<div class="nav-item' + (activeSection === item.id ? ' active' : '') + '" data-section="' + item.id + '">' +
      '<span class="nav-icon">' + item.icon + '</span><span class="nav-label">' + item.label + '</span>' +
    '</div>'
  ).join('');

  let mainHtml = '';

  if (activeSection === 'source') {
    mainHtml += renderSourceCard(s, lastFetched);
  } else if (activeSection === 'playback') {
    mainHtml += renderPlaybackCard();
  } else {
    mainHtml += renderAboutCard();
  }

  mainHtml += '<div class="settings-footer">';
  mainHtml += '<span class="footer-info">All settings are saved automatically</span>';
  mainHtml += '<span class="footer-version">' + APP_VERSION + '</span>';
  mainHtml += '</div>';

  container.innerHTML =
    '<div class="bg-glow"></div>' +
    '<div class="settings-layout">' +
      '<nav class="settings-nav">' +
        '<div class="nav-header">' +
          '<div class="nav-logo">' +
            '<img class="icon" src="logo.svg" alt="EN IPTV logo">' +
            '<div class="text">EN <span>IPTV</span></div>' +
          '</div>' +
          '<div class="nav-sub">Settings</div>' +
        '</div>' +
        '<div class="nav-items">' + navHtml + '</div>' +
      '</nav>' +
      '<main class="settings-main">' + mainHtml + '</main>' +
    '</div>' +
    '<div id="remote-hints">' +
      '<div class="hint-group"><kbd>&#9650;</kbd> <kbd>&#9660;</kbd> <span class="sep">|</span> Navigate</div>' +
      '<div class="hint-group"><kbd>Enter</kbd> <span class="sep">|</span> Select / Toggle</div>' +
      '<div class="hint-group"><kbd>&#9664;</kbd> <span class="sep">|</span> Back</div>' +
      '<div class="hint-group"><kbd>Back</kbd> <span class="sep">|</span> Close</div>' +
    '</div>';

  buildFocusOrder();

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      activeSection = item.dataset.section;
      focusIdx = 0;
      render();
      applyFocus();
    });
  });

  if (activeSection === 'source') {
    for (let i = 0; i < s.playlists.length; i++) {
      const entry = document.getElementById('playlist-entry-' + i);
      if (entry) {
        entry.addEventListener('click', () => {
          saveSettings({ activePlaylistIndex: i });
          render();
          applyFocus();
        });
      }
      const editBtn = document.getElementById('pl-edit-' + i);
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          editMode = true;
          editIndex = i;
          render();
          applyFocus();
        });
      }
      const deleteBtn = document.getElementById('pl-delete-' + i);
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const p = getSettings().playlists[i];
          const name = p ? p.name : 'this playlist';
          ui.showConfirmDialog(`Delete "${name}"?`, (confirmed) => {
            if (!confirmed) return;
            const playlists = getSettings().playlists.filter((_, j) => j !== i);
            let active = getSettings().activePlaylistIndex;
            if (active >= playlists.length) active = playlists.length - 1;
            if (active < 0) active = -1;
            saveSettings({ playlists, activePlaylistIndex: active });
            render();
            applyFocus();
          });
        });
      }
    }
    const addBtn = document.getElementById('pl-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        addMode = true;
        render();
        applyFocus();
      });
    }
    const saveBtn = document.getElementById('pl-add-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        saveAddPlaylist();
      });
    }
    const addTypeM3u = document.getElementById('pl-add-type-m3u');
    if (addTypeM3u) {
      addTypeM3u.addEventListener('click', () => setFormType('pl-add', 'm3u'));
    }
    const addTypeXtream = document.getElementById('pl-add-type-xtream');
    if (addTypeXtream) {
      addTypeXtream.addEventListener('click', () => setFormType('pl-add', 'xtream'));
    }
    const addTestBtn = document.getElementById('pl-add-test');
    if (addTestBtn) {
      addTestBtn.addEventListener('click', () => testXtreamLogin('pl-add'));
    }
    const cancelBtn = document.getElementById('pl-add-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        addMode = false;
        render();
        applyFocus();
      });
    }
    const editSaveBtn = document.getElementById('pl-edit-save');
    if (editSaveBtn) {
      editSaveBtn.addEventListener('click', () => {
        saveEditPlaylist();
      });
    }
    const editTypeM3u = document.getElementById('pl-edit-type-m3u');
    if (editTypeM3u) {
      editTypeM3u.addEventListener('click', () => setFormType('pl-edit', 'm3u'));
    }
    const editTypeXtream = document.getElementById('pl-edit-type-xtream');
    if (editTypeXtream) {
      editTypeXtream.addEventListener('click', () => setFormType('pl-edit', 'xtream'));
    }
    const editTestBtn = document.getElementById('pl-edit-test');
    if (editTestBtn) {
      editTestBtn.addEventListener('click', () => testXtreamLogin('pl-edit'));
    }
    const editCancelBtn = document.getElementById('pl-edit-cancel');
    if (editCancelBtn) {
      editCancelBtn.addEventListener('click', () => {
        editMode = false;
        editIndex = -1;
        render();
        applyFocus();
      });
    }
    document.getElementById('settings-fetch-btn').addEventListener('click', handleFetch);
  } else if (activeSection === 'playback') {
    document.querySelectorAll('.toggle').forEach(t => {
      t.addEventListener('click', function() {
        this.classList.toggle('on');
        if (this.id === 'toggle-autoq') {
          const enabled = this.classList.contains('on');
          saveSettings({ autoQuality: enabled });
          player.setAutoQuality(enabled);
        } else if (this.id === 'toggle-auto-refresh') {
          const enabled = this.classList.contains('on');
          saveSettings({ autoRefreshPlaylist: enabled });
        } else if (this.id === 'toggle-update-check') {
          const enabled = this.classList.contains('on');
          setConsented(enabled);
        } else if (this.id === 'toggle-watermark') {
          const enabled = this.classList.contains('on');
          saveSettings({ showWatermark: enabled });
          ui.setOverlayVisibility({ watermark: enabled });
        } else if (this.id === 'toggle-badge') {
          const enabled = this.classList.contains('on');
          saveSettings({ showResolutionBadge: enabled });
          ui.setOverlayVisibility({ badge: enabled });
        } else if (this.id === 'toggle-proxymenu') {
          const enabled = this.classList.contains('on');
          saveSettings({ showProxyMenu: enabled });
        } else if (this.id === 'toggle-channelsort') {
          const enabled = this.classList.contains('on');
          saveSettings({ channelSort: enabled ? 'provider' : 'name' });
        } else if (this.id.startsWith('show-group-')) {
          const idx = parseInt(this.id.slice('show-group-'.length), 10);
          const name = groupNames()[idx];
          if (name) {
            const shown = this.classList.contains('on');
            const hidden = (getSettings().hiddenGroups || []).filter(g => g !== name);
            if (!shown) hidden.push(name);
            saveSettings({ hiddenGroups: hidden });
          }
        }
      });
    });
  }

  if (typeof onRender === 'function') onRender();
}

function renderSourceCard(s, lastFetched) {
  let html = '';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">\u{1F4E1}</span> Channel Source</h3></div>';
  html += '<div class="card-body">';
  html += '<p class="hint" style="margin-bottom:32px;">Saved playlists (' + s.playlists.length + '/' + MAX_PLAYLISTS + '). Select one, then press Active.</p>';
  if (addMode) {
    html += '<div class="input-group">';
    html += '<label for="pl-add-name">Playlist Name</label>';
    html += '<input id="pl-add-name" class="input-field" type="text" placeholder="My Playlist" />';
    html += '</div>';
    html += '<div class="input-group">';
    html += '<label>Source Type</label>';
    html += '<div class="select-grid">';
    html += '<button id="pl-add-type-m3u" class="select-opt' + (addType !== 'xtream' ? ' active' : '') + '" type="button">M3U URL</button>';
    html += '<button id="pl-add-type-xtream" class="select-opt' + (addType === 'xtream' ? ' active' : '') + '" type="button">Xtream Login</button>';
    html += '</div>';
    html += '</div>';
    html += '<div id="pl-add-m3u-fields"' + (addType === 'xtream' ? ' class="hidden"' : '') + '>';
    html += '<div class="input-group">';
    html += '<label for="pl-add-url">Playlist URL</label>';
    html += '<input id="pl-add-url" class="input-field" type="text" placeholder="https://..." />';
    html += '</div>';
    html += '</div>';
    html += '<div id="pl-add-xtream-fields"' + (addType !== 'xtream' ? ' class="hidden"' : '') + '>';
    html += '<div class="input-group">';
    html += '<label for="pl-add-host">Host</label>';
    html += '<input id="pl-add-host" class="input-field" type="text" placeholder="http://host:port" />';
    html += '</div>';
    html += '<div class="input-group">';
    html += '<label for="pl-add-user">Username</label>';
    html += '<input id="pl-add-user" class="input-field" type="text" placeholder="Username" />';
    html += '</div>';
    html += '<div class="input-group">';
    html += '<label for="pl-add-pass">Password</label>';
    html += '<input id="pl-add-pass" class="input-field" type="password" placeholder="Password" />';
    html += '</div>';
    html += '<div class="btn-group">';
    html += '<button id="pl-add-test" class="btn btn-secondary" type="button">Test Login</button>';
    html += '</div>';
    html += '<div id="pl-add-test-status" class="status-info hidden" style="margin-top:12px;"></div>';
    html += '</div>';
    html += '<div class="btn-group">';
    html += '<button id="pl-add-save" class="btn btn-primary">Save</button>';
    html += '<button id="pl-add-cancel" class="btn btn-secondary">Cancel</button>';
    html += '</div>';
  } else {
    html += '<div class="playlist-list">';
    for (let i = 0; i < s.playlists.length; i++) {
      const p = s.playlists[i];
      const isActive = i === s.activePlaylistIndex;
      if (editMode && editIndex === i) {
        const et = p.type === 'xtream' ? 'xtream' : 'm3u';
        html += '<div id="playlist-entry-' + i + '" class="playlist-entry active">';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-name">Playlist Name</label>';
        html += '<input id="pl-edit-name" class="input-field" type="text" value="' + escapeHtml(p.name || '') + '" placeholder="My Playlist" />';
        html += '</div>';
        html += '<div class="input-group">';
        html += '<label>Source Type</label>';
        html += '<div class="select-grid">';
        html += '<button id="pl-edit-type-m3u" class="select-opt' + (et !== 'xtream' ? ' active' : '') + '" type="button">M3U URL</button>';
        html += '<button id="pl-edit-type-xtream" class="select-opt' + (et === 'xtream' ? ' active' : '') + '" type="button">Xtream Login</button>';
        html += '</div>';
        html += '</div>';
        html += '<div id="pl-edit-m3u-fields"' + (et === 'xtream' ? ' class="hidden"' : '') + '>';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-url">Playlist URL</label>';
        html += '<input id="pl-edit-url" class="input-field" type="text" value="' + escapeHtml(p.url || '') + '" placeholder="https://..." />';
        html += '</div>';
        html += '</div>';
        html += '<div id="pl-edit-xtream-fields"' + (et !== 'xtream' ? ' class="hidden"' : '') + '>';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-host">Host</label>';
        html += '<input id="pl-edit-host" class="input-field" type="text" value="' + escapeHtml(p.host || p.url || '') + '" placeholder="http://host:port" />';
        html += '</div>';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-user">Username</label>';
        html += '<input id="pl-edit-user" class="input-field" type="text" value="' + escapeHtml(p.username || '') + '" placeholder="Username" />';
        html += '</div>';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-pass">Password</label>';
        html += '<input id="pl-edit-pass" class="input-field" type="password" placeholder="Password" />';
        html += '</div>';
        html += '<div class="btn-group">';
        html += '<button id="pl-edit-test" class="btn btn-secondary" type="button">Test Login</button>';
        html += '</div>';
        html += '<div id="pl-edit-test-status" class="status-info hidden" style="margin-top:12px;"></div>';
        html += '</div>';
        html += '<div class="btn-group">';
        html += '<button id="pl-edit-save" class="btn btn-primary">Save</button>';
        html += '<button id="pl-edit-cancel" class="btn btn-secondary">Cancel</button>';
        html += '</div>';
        html += '</div>';
      } else {
        html += '<div id="playlist-entry-' + i + '" class="playlist-entry' + (isActive ? ' active' : '') + '">';
        html += '<div class="playlist-header">';
        html += '<span class="playlist-indicator">' + (isActive ? '\u25B6' : '\u25CB') + '</span>';
        html += '<span class="playlist-name">' + escapeHtml(p.name || 'Unnamed') + '</span>';
        if (isActive) {
          html += '<span class="selected-badge">\u2713 Selected</span>';
        }
        html += '</div>';
        html += '<span class="playlist-url">' + escapeHtml(p.url || '') + '</span>';
        html += '<span class="playlist-meta">Added ' + formatDate(p.addedAt) + ' \u2022 Last played ' + (p.lastPlayedAt ? timeAgo(p.lastPlayedAt) : 'Never') + '</span>';
        html += '<div class="btn-group">';
        html += '<button id="pl-edit-' + i + '" class="btn btn-secondary">Edit</button>';
        html += '<button id="pl-delete-' + i + '" class="btn btn-secondary">Delete</button>';
        html += '</div>';
        html += '</div>';
      }
    }
    html += '</div>';
    html += '<div class="btn-group">';
    if (s.playlists.length < MAX_PLAYLISTS) {
      html += '<button id="pl-add-btn" class="btn btn-secondary">+ Add Playlist</button>';
    }
    html += '<button id="settings-fetch-btn" class="btn btn-primary">Active</button>';
    html += '</div>';
    html += '<div id="settings-fetch-status" class="status-info hidden" style="margin-top:24px;"></div>';
    html += '<p class="hint" style="margin-top:32px;">Last fetched: ' + lastFetched + '</p>';
  }
  html += '</div></div>';
  return html;
}

function renderPlaybackCard() {
  const s = getSettings();
  const autoQ = s.autoQuality !== false;
  const autoRefresh = s.autoRefreshPlaylist !== false;
  const updateCheck = s.updateCheck === true;
  const watermark = s.showWatermark !== false;
  const badge = s.showResolutionBadge !== false;
  const proxyMenu = s.showProxyMenu === true;
  const providerSort = s.channelSort !== 'name';
  let html = '';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">&#x25B6;</span> Playback</h3></div>';
  html += '<div class="card-body">';
  html += '<div class="toggle-row">';
  html += '<div><div class="toggle-label">Auto quality</div><div class="toggle-desc">Automatically adjust resolution based on bandwidth</div></div>';
  html += '<div class="toggle' + (autoQ ? ' on' : '') + '" id="toggle-autoq"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html += '<div><div class="toggle-label">Auto refresh playlist</div><div class="toggle-desc">Download and update playlist from source on app launch</div></div>';
  html += '<div class="toggle' + (autoRefresh ? ' on' : '') + '" id="toggle-auto-refresh"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html += '<div><div class="toggle-label">Check for updates</div><div class="toggle-desc">Notify when a new version is available (anonymous)</div></div>';
  html += '<div class="toggle' + (updateCheck ? ' on' : '') + '" id="toggle-update-check"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html += '<div><div class="toggle-label">App logo</div><div class="toggle-desc">Show logo and name in the top-left corner</div></div>';
  html += '<div class="toggle' + (watermark ? ' on' : '') + '" id="toggle-watermark"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html += '<div><div class="toggle-label">Quality badge</div><div class="toggle-desc">Show quality and stream type in the top-right corner</div></div>';
  html += '<div class="toggle' + (badge ? ' on' : '') + '" id="toggle-badge"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html += '<div><div class="toggle-label">Proxy menu</div><div class="toggle-desc">Show per-channel proxy option in the sidebar menu</div></div>';
  html += '<div class="toggle' + (proxyMenu ? ' on' : '') + '" id="toggle-proxymenu"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html += '<div><div class="toggle-label">Provider order</div><div class="toggle-desc">List channels in provider order instead of A–Z (applies on next refresh)</div></div>';
  html += '<div class="toggle' + (providerSort ? ' on' : '') + '" id="toggle-channelsort"><div class="knob"></div></div>';
  html += '</div>';
  html += '</div></div>';
  html += renderGroupsCard();
  return html;
}

function groupNames() {
  const map = {};
  for (const ch of getSettings().channels || []) {
    const g = ((ch && ch.group) || 'Ungrouped');
    map[g] = (map[g] || 0) + 1;
  }
  return Object.keys(map).sort();
}

function groupChannelCount(name) {
  return (getSettings().channels || []).filter(ch => (((ch && ch.group) || 'Ungrouped') === name)).length;
}

function renderGroupsCard() {
  const hidden = getSettings().hiddenGroups || [];
  const names = groupNames();
  let html = '';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">\u{1F4C1}</span> Groups</h3></div>';
  html += '<div class="card-body">';
  if (names.length === 0) {
    html += '<div class="toggle-row"><div><div class="toggle-label">No groups yet</div><div class="toggle-desc">Load a playlist to manage groups</div></div></div>';
  }
  names.forEach((name, i) => {
    const shown = !hidden.includes(name);
    html += '<div class="toggle-row">';
    html += '<div><div class="toggle-label">' + escapeHtml(name) + '</div><div class="toggle-desc">' + groupChannelCount(name) + ' channels</div></div>';
    html += '<div class="toggle' + (shown ? ' on' : '') + '" id="show-group-' + i + '"><div class="knob"></div></div>';
    html += '</div>';
  });
  html += '</div></div>';
  return html;
}

function renderAboutCard() {  let html = '';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">\u2139</span> About</h3></div>';
  html += '<div class="card-body">';
  html += '<p class="about-text">EN IPTV Player is built for modern IPTV sources, with first-class support for MPD streams and tokenized live channels that other Tizen players drop.</p>';
  html += '<div class="toggle-row"><div><div class="toggle-label">App</div></div><div class="toggle-value">EN IPTV Player</div></div>';
  html += '<div class="toggle-row"><div><div class="toggle-label">Version</div></div><div class="toggle-value">' + APP_VERSION + '</div></div>';
  html += '<div class="toggle-row"><div><div class="toggle-label">Engine</div></div><div class="toggle-value">Shaka Player</div></div>';
  html += '<div class="toggle-row"><div><div class="toggle-label">Native playback</div></div><div class="toggle-value">' + (player.isNativeAvailable() ? 'Available' : 'Not available') + '</div></div>';
  html += '</div></div>';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">\u{1F517}</span> Links</h3></div>';
  html += '<div class="card-body">';
  html += '<div class="toggle-row"><div><div class="toggle-label">Developer</div></div><div class="toggle-value">Nur-allhi</div></div>';
  html += '<div class="toggle-row"><div><div class="toggle-label">GitHub</div></div><div class="toggle-value"><a class="about-link" href="https://github.com/Nur-allhi" target="_blank" rel="noopener">github.com/Nur-allhi</a></div></div>';
  html += '<div class="toggle-row"><div><div class="toggle-label">Telegram</div></div><div class="toggle-value"><a class="about-link" href="https://t.me/eniptvplayer" target="_blank" rel="noopener">t.me/eniptvplayer</a></div></div>';
  html += '</div></div>';
  return html;
}

async function handleFetch() {
  const fetchBtn = document.getElementById('settings-fetch-btn');
  const statusEl = document.getElementById('settings-fetch-status');
  if (!statusEl) return;
  const active = getActivePlaylist();
  if (!active || (active.type !== 'xtream' && !active.url)) {
    statusEl.className = 'status-info';
    statusEl.textContent = 'Select or add a playlist first';
    statusEl.classList.remove('hidden');
    return;
  }
  // Disable button to prevent double-click during fetch
  if (fetchBtn) fetchBtn.disabled = true;
  statusEl.className = 'status-info';
  statusEl.textContent = 'Fetching...';
  statusEl.classList.remove('hidden');
  try {
    const channels = await fetchPlaylistEntry(active);
    saveSettings({ channels, channelsFetched: new Date().toISOString() });
    statusEl.textContent = 'Fetched ' + channels.length + ' channels';
    if (onPlaylistFetched) onPlaylistFetched(channels);
  } catch (e) {
    statusEl.textContent = 'Could not load playlist: ' + e.message;
  } finally {
    if (fetchBtn) fetchBtn.disabled = false;
  }
}

function formatDate(isoString) {
  if (!isoString) return 'Never';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString();
}

function timeAgo(isoString) {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  return new Date(isoString).toLocaleDateString();
}


