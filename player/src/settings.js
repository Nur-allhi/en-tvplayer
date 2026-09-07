import { getSettings, saveSettings, getActivePlaylist, APP_VERSION } from './config.js';
import { processStreamUrl, parseM3u, fetchPlaylist, escapeHtml } from './utils.js';
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

const NAV_ITEMS = [
  { id: 'source', icon: '📡', label: 'Channel Source' },
  { id: 'playback', icon: '▶', label: 'Playback' },
  { id: 'about', icon: 'ℹ', label: 'About' },
];

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
    // On TV the remote layer intercepts Enter/OK and routes it here, so the
    // desktop-only keydown Enter handlers never run. Make OK inside a text
    // field act like pressing Enter on a desktop form: advance to the next
    // field, or save from the last field (playlist URL).
    if (el.id === 'pl-add-name') {
      moveSettingsFocus('pl-add-url');
    } else if (el.id === 'pl-add-url') {
      saveAddPlaylist();
    } else if (el.id === 'pl-edit-name') {
      moveSettingsFocus('pl-edit-url');
    } else if (el.id === 'pl-edit-url') {
      saveEditPlaylist();
    } else {
      el.focus();
    }
    return;
  }

  if (el.id === 'pl-add-btn') {
    addMode = true;
    render();
    applyFocus();
    return;
  }

  // NOTE: only match per-row buttons like "pl-edit-0". The edit form's
  // "pl-edit-save"/"pl-edit-cancel" buttons start with the same prefix and
  // used to be swallowed here, so editing a playlist never saved.
  if (el.id && /^pl-edit-\d+$/.test(el.id)) {
    const idx = parseInt(el.id.split('-')[2], 10);
    editMode = true;
    editIndex = idx;
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
  const urlEl = document.getElementById('pl-add-url');
  const name = nameEl ? nameEl.value.trim() : '';
  const url = urlEl ? urlEl.value.trim() : '';
  if (!url) return;
  const playlists = getSettings().playlists;
  playlists.push({ name: name || 'Unnamed', url });
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

function saveEditPlaylist() {
  const nameEl = document.getElementById('pl-edit-name');
  const urlEl = document.getElementById('pl-edit-url');
  const name = nameEl ? nameEl.value.trim() : '';
  const url = urlEl ? urlEl.value.trim() : '';
  if (!url || editIndex < 0) return;
  const playlists = getSettings().playlists;
  playlists[editIndex] = { name: name || 'Unnamed', url };
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

function buildFocusOrder() {
  focusOrder = [];
  document.querySelectorAll('.nav-item').forEach(el => focusOrder.push(el));

  if (activeSection === 'source') {
    if (addMode) {
      focusOrder.push(document.getElementById('pl-add-name'));
      focusOrder.push(document.getElementById('pl-add-url'));
      focusOrder.push(document.getElementById('pl-add-save'));
      focusOrder.push(document.getElementById('pl-add-cancel'));
    } else if (editMode && editIndex >= 0) {
      focusOrder.push(document.getElementById('pl-edit-name'));
      focusOrder.push(document.getElementById('pl-edit-url'));
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
  }
}

function clearFocus() {
  document.querySelectorAll('[data-focused]').forEach(el => el.removeAttribute('data-focused'));
}

function applyFocus() {
  clearFocus();
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
      '<span class="nav-icon">' + item.icon + '</span> ' + item.label +
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
            '<div class="icon">EN</div>' +
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
        const nameEl = document.getElementById('pl-add-name');
        const urlEl = document.getElementById('pl-add-url');
        const name = nameEl ? nameEl.value.trim() : '';
        const url = urlEl ? urlEl.value.trim() : '';
        if (url) {
          const playlists = getSettings().playlists;
          playlists.push({ name: name || 'Unnamed', url });
          saveSettings({ playlists, activePlaylistIndex: playlists.length - 1 });
          addMode = false;
          render();
          applyFocus();
        }
      });
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
        const nameEl = document.getElementById('pl-edit-name');
        const urlEl = document.getElementById('pl-edit-url');
        const name = nameEl ? nameEl.value.trim() : '';
        const url = urlEl ? urlEl.value.trim() : '';
        if (url && editIndex >= 0) {
          const playlists = getSettings().playlists;
          playlists[editIndex] = { name: name || 'Unnamed', url };
          saveSettings({ playlists });
          editMode = false;
          editIndex = -1;
          render();
          applyFocus();
        }
      });
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
  html += '<p class="hint" style="margin-bottom:32px;">Saved playlists (' + s.playlists.length + '/8). Select one, then click Fetch.</p>';
  if (addMode) {
    html += '<div class="input-group">';
    html += '<label for="pl-add-name">Playlist Name</label>';
    html += '<input id="pl-add-name" class="input-field" type="text" placeholder="My Playlist" />';
    html += '</div>';
    html += '<div class="input-group">';
    html += '<label for="pl-add-url">Playlist URL</label>';
    html += '<input id="pl-add-url" class="input-field" type="text" placeholder="https://..." />';
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
        html += '<div id="playlist-entry-' + i + '" class="playlist-entry active">';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-name">Playlist Name</label>';
        html += '<input id="pl-edit-name" class="input-field" type="text" value="' + escapeHtml(p.name || '') + '" placeholder="My Playlist" />';
        html += '</div>';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-url">Playlist URL</label>';
        html += '<input id="pl-edit-url" class="input-field" type="text" value="' + escapeHtml(p.url || '') + '" placeholder="https://..." />';
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
        html += '<div class="btn-group">';
        html += '<button id="pl-edit-' + i + '" class="btn btn-secondary">Edit</button>';
        html += '<button id="pl-delete-' + i + '" class="btn btn-secondary">Delete</button>';
        html += '</div>';
        html += '</div>';
      }
    }
    html += '</div>';
    html += '<div class="btn-group">';
    if (s.playlists.length < 8) {
      html += '<button id="pl-add-btn" class="btn btn-secondary">+ Add Playlist</button>';
    }
    html += '<button id="settings-fetch-btn" class="btn btn-primary">Fetch Active</button>';
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
  html += '</div></div>';
  return html;
}

function renderAboutCard() {
  let html = '';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">\u2139</span> About</h3></div>';
  html += '<div class="card-body">';
  html += '<div class="input-group">';
  html += '<label>EN IPTV Player</label>';
  html += '<div class="hint" style="margin-top:4px;">Tizen TV App &middot; Version ' + APP_VERSION + '</div>';
  html += '<div class="hint" style="margin-top:2px;">Open-source IPTV player for Samsung Tizen TVs and desktop browsers.</div>';
  html += '<div class="hint" style="margin-top:2px;">Powered by Shaka Player.</div>';
  html += '<div class="hint" style="margin-top:2px;">Native playback: ' + (player.isNativeAvailable() ? 'available' : 'not available') + '</div>';
  html += '</div>';
  html += '</div></div>';
  return html;
}

async function handleFetch() {
  const fetchBtn = document.getElementById('settings-fetch-btn');
  const statusEl = document.getElementById('settings-fetch-status');
  if (!statusEl) return;
  const active = getActivePlaylist();
  if (!active || !active.url) {
    statusEl.className = 'status-info';
    statusEl.textContent = 'Select or add a playlist with a URL first';
    statusEl.classList.remove('hidden');
    return;
  }
  // Disable button to prevent double-click during fetch
  if (fetchBtn) fetchBtn.disabled = true;
  statusEl.className = 'status-info';
  statusEl.textContent = 'Fetching...';
  statusEl.classList.remove('hidden');
  try {
    const channels = await fetchPlaylist(active.url);
    saveSettings({ channels, channelsFetched: new Date().toISOString() });
    statusEl.textContent = 'Fetched ' + channels.length + ' channels';
    if (onPlaylistFetched) onPlaylistFetched(channels);
  } catch (e) {
    statusEl.textContent = 'Could not load playlist: ' + e.message;
  } finally {
    if (fetchBtn) fetchBtn.disabled = false;
  }
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


