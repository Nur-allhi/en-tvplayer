import { getSettings, saveSettings, getActivePlaylist, APP_VERSION } from './config.js';
import { fetchPlaylistEntry, escapeHtml } from './utils.js';
import { login as xtreamLogin } from './xtream.js';
import { setConsented } from './update.js';
import * as player from './player/index.js';
import * as ui from './ui/index.js';
import { timeAgo, formatDate } from './lib/time.js';
// T-140: navigation and OK/Enter handling moved to their own slices.
import { state } from './settings/state.js';
import { deps } from './settings/deps.js';
export { navigate, navigateNav } from './settings/nav.js';
export { selectFocused } from './settings/select.js';
// T-140: wire the callbacks the nav/select slices call through deps.
Object.assign(deps, {
  render,
  saveAddPlaylist,
  saveEditPlaylist,
  setFormType,
  testXtreamLogin,
  handleFetch,
  groupNames,
});

// Playlist form type: 'm3u' (URL) or 'xtream' (host + credentials).

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
// The Tizen check now lives in settings/nav.js and settings/select.js.
export function init(settingsContainer, callbacks) {
  state.container = settingsContainer;
  state.onPlaylistFetched = callbacks.onPlaylistFetched;
  state.onRender = callbacks.onRender;
}

export function show() {
  if (!state.container) return;
  state.editIndex = -1;
  state.addMode = false;
  state.editMode = false;
  state.activeSection = 'source';
  state.focusIdx = 0;
  state.container.classList.remove('hidden');
  render();
  deps.applyFocus();
}

// Opens Settings → Source with the add form showing, preset to the given
// type ('m3u' or 'xtream'). Used by the first-run source picker.
export function openAddForm(type) {
  if (!state.container) return;
  state.activeSection = 'source';
  state.addMode = true;
  state.editMode = false;
  state.editIndex = -1;
  state.addType = type === 'xtream' ? 'xtream' : 'm3u';
  state.focusIdx = 0;
  state.container.classList.remove('hidden');
  render();
  deps.applyFocus();
}

export function hide() {
  if (!state.container) return;
  state.container.classList.add('hidden');
}

export function isVisible() {
  return state.container && !state.container.classList.contains('hidden');
}

// Move focus to another element by id through the normal focus-order machinery.
// Used to make Enter/OK advance from the name field to the URL field.

function saveAddPlaylist() {
  const nameEl = document.getElementById('pl-add-name');
  const name = nameEl ? nameEl.value.trim() : '';
  const settings = getSettings();
  if (settings.playlists.length >= MAX_PLAYLISTS) return;
  const playlists = settings.playlists;
  const base = { name: name || 'Unnamed', addedAt: new Date().toISOString(), lastPlayedAt: null };
  if (state.addType === 'xtream') {
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
  state.addMode = false;
  render();
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    activeEl.blur();
  }
  document.body.focus();
  state.focusIdx = 0;
  deps.applyFocus();
}

function valOf(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function saveEditPlaylist() {
  const nameEl = document.getElementById('pl-edit-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (state.editIndex < 0) return;
  const playlists = getSettings().playlists;
  if (state.editType === 'xtream') {
    const host = valOf('pl-edit-host');
    const username = valOf('pl-edit-user');
    const password = document.getElementById('pl-edit-pass') ? document.getElementById('pl-edit-pass').value : '';
    if (!host || !username || !password) return;
    playlists[state.editIndex] = {
      ...playlists[state.editIndex],
      name: name || 'Unnamed',
      type: 'xtream',
      host,
      username,
      password,
      url: host,
    };
  } else {
    const url = valOf('pl-edit-url');
    if (!url) return;
    playlists[state.editIndex] = { ...playlists[state.editIndex], name: name || 'Unnamed', type: 'm3u', url };
  }
  saveSettings({ playlists });
  state.editMode = false;
  state.editIndex = -1;
  render();
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    activeEl.blur();
  }
  document.body.focus();
  state.focusIdx = 0;
  deps.applyFocus();
}

// Switches the add/edit form between M3U URL and Xtream login fields
// without re-rendering (typed values survive).
function setFormType(prefix, type) {
  if (prefix === 'pl-add') state.addType = type;
  else state.editType = type;
  const m3u = document.getElementById(prefix + '-m3u-fields');
  const xt = document.getElementById(prefix + '-xtream-fields');
  if (m3u) m3u.classList.toggle('hidden', type !== 'm3u');
  if (xt) xt.classList.toggle('hidden', type !== 'xtream');
  const m3uBtn = document.getElementById(prefix + '-type-m3u');
  const xtBtn = document.getElementById(prefix + '-type-xtream');
  if (m3uBtn) m3uBtn.classList.toggle('active', type === 'm3u');
  if (xtBtn) xtBtn.classList.toggle('active', type === 'xtream');
  const testBtn = document.getElementById(prefix + '-test');
  if (testBtn) testBtn.classList.toggle('hidden', type !== 'xtream');
  deps.moveSettingsFocus(prefix + (type === 'm3u' ? '-url' : '-host'));
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

function render() {
  const s = getSettings();
  const lastFetched = s.channelsFetched ? timeAgo(s.channelsFetched) : 'Never';

  const navHtml = NAV_ITEMS.map(
    (item) =>
      '<div class="nav-item' +
      (state.activeSection === item.id ? ' active' : '') +
      '" data-section="' +
      item.id +
      '">' +
      '<span class="nav-icon">' +
      item.icon +
      '</span><span class="nav-label">' +
      item.label +
      '</span>' +
      '</div>',
  ).join('');

  let mainHtml = '';

  if (state.activeSection === 'source') {
    mainHtml += renderSourceCard(s, lastFetched);
  } else if (state.activeSection === 'playback') {
    mainHtml += renderPlaybackCard();
  } else {
    mainHtml += renderAboutCard();
  }

  mainHtml += '<div class="settings-footer">';
  mainHtml += '<span class="footer-info">All settings are saved automatically</span>';
  mainHtml += '<span class="footer-version">' + APP_VERSION + '</span>';
  mainHtml += '</div>';

  state.container.innerHTML =
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
    '<div class="nav-items">' +
    navHtml +
    '</div>' +
    '</nav>' +
    '<main class="settings-main">' +
    mainHtml +
    '</main>' +
    '</div>' +
    '<div id="remote-hints">' +
    '<div class="hint-group"><kbd>&#9650;</kbd> <kbd>&#9660;</kbd> <span class="sep">|</span> Navigate</div>' +
    '<div class="hint-group"><kbd>Enter</kbd> <span class="sep">|</span> Select / Toggle</div>' +
    '<div class="hint-group"><kbd>&#9664;</kbd> <span class="sep">|</span> Back</div>' +
    '<div class="hint-group"><kbd>Back</kbd> <span class="sep">|</span> Close</div>' +
    '</div>';

  deps.buildFocusOrder();

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      state.activeSection = item.dataset.section;
      state.focusIdx = 0;
      render();
      deps.applyFocus();
    });
  });

  if (state.activeSection === 'source') {
    for (let i = 0; i < s.playlists.length; i++) {
      const entry = document.getElementById('playlist-entry-' + i);
      if (entry) {
        entry.addEventListener('click', () => {
          saveSettings({ activePlaylistIndex: i });
          render();
          deps.applyFocus();
        });
      }
      const editBtn = document.getElementById('pl-edit-' + i);
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.editMode = true;
          state.editIndex = i;
          render();
          deps.applyFocus();
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
            deps.applyFocus();
          });
        });
      }
    }
    const addBtn = document.getElementById('pl-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        state.addMode = true;
        render();
        deps.applyFocus();
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
        state.addMode = false;
        render();
        deps.applyFocus();
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
        state.editMode = false;
        state.editIndex = -1;
        render();
        deps.applyFocus();
      });
    }
    document.getElementById('settings-fetch-btn').addEventListener('click', handleFetch);
  } else if (state.activeSection === 'playback') {
    document.querySelectorAll('.toggle').forEach((t) => {
      t.addEventListener('click', function () {
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
            const hidden = (getSettings().hiddenGroups || []).filter((g) => g !== name);
            if (!shown) hidden.push(name);
            saveSettings({ hiddenGroups: hidden });
          }
        }
      });
    });
  }

  if (typeof state.onRender === 'function') state.onRender();
}

function renderSourceCard(s, lastFetched) {
  let html = '';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">\u{1F4E1}</span> Channel Source</h3></div>';
  html += '<div class="card-body">';
  html +=
    '<p class="hint" style="margin-bottom:32px;">Saved playlists (' +
    s.playlists.length +
    '/' +
    MAX_PLAYLISTS +
    '). Select one, then press Active.</p>';
  if (state.addMode) {
    html += '<div class="input-group">';
    html += '<label>Source Type</label>';
    html += '<div class="select-grid">';
    html +=
      '<button id="pl-add-type-m3u" class="select-opt' +
      (state.addType !== 'xtream' ? ' active' : '') +
      '" type="button">M3U URL</button>';
    html +=
      '<button id="pl-add-type-xtream" class="select-opt' +
      (state.addType === 'xtream' ? ' active' : '') +
      '" type="button">Xtream Login</button>';
    html += '</div>';
    html += '</div>';
    html += '<div id="pl-add-m3u-fields"' + (state.addType === 'xtream' ? ' class="hidden"' : '') + '>';
    html += '<div class="input-group">';
    html += '<label for="pl-add-url">Playlist URL</label>';
    html += '<input id="pl-add-url" class="input-field" type="text" placeholder="https://..." />';
    html += '</div>';
    html += '</div>';
    html += '<div id="pl-add-xtream-fields"' + (state.addType !== 'xtream' ? ' class="hidden"' : '') + '>';
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
    html += '<div id="pl-add-test-status" class="status-info hidden" style="margin-top:12px;"></div>';
    html += '</div>';
    html += '<div class="input-group">';
    html += '<label for="pl-add-name">Playlist Name</label>';
    html += '<input id="pl-add-name" class="input-field" type="text" placeholder="My Playlist" />';
    html += '</div>';
    html += '<div class="btn-group">';
    html +=
      '<button id="pl-add-test" class="btn btn-secondary' +
      (state.addType !== 'xtream' ? ' hidden' : '') +
      '" type="button">Test Login</button>';
    html += '<button id="pl-add-save" class="btn btn-primary">Save</button>';
    html += '<button id="pl-add-cancel" class="btn btn-secondary">Cancel</button>';
    html += '</div>';
  } else {
    html += '<div class="playlist-list">';
    for (let i = 0; i < s.playlists.length; i++) {
      const p = s.playlists[i];
      const isActive = i === s.activePlaylistIndex;
      if (state.editMode && state.editIndex === i) {
        const et = p.type === 'xtream' ? 'xtream' : 'm3u';
        html += '<div id="playlist-entry-' + i + '" class="playlist-entry active">';
        html += '<div class="input-group">';
        html += '<label>Source Type</label>';
        html += '<div class="select-grid">';
        html +=
          '<button id="pl-edit-type-m3u" class="select-opt' +
          (et !== 'xtream' ? ' active' : '') +
          '" type="button">M3U URL</button>';
        html +=
          '<button id="pl-edit-type-xtream" class="select-opt' +
          (et === 'xtream' ? ' active' : '') +
          '" type="button">Xtream Login</button>';
        html += '</div>';
        html += '</div>';
        html += '<div id="pl-edit-m3u-fields"' + (et === 'xtream' ? ' class="hidden"' : '') + '>';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-url">Playlist URL</label>';
        html +=
          '<input id="pl-edit-url" class="input-field" type="text" value="' +
          escapeHtml(p.url || '') +
          '" placeholder="https://..." />';
        html += '</div>';
        html += '</div>';
        html += '<div id="pl-edit-xtream-fields"' + (et !== 'xtream' ? ' class="hidden"' : '') + '>';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-host">Host</label>';
        html +=
          '<input id="pl-edit-host" class="input-field" type="text" value="' +
          escapeHtml(p.host || p.url || '') +
          '" placeholder="http://host:port" />';
        html += '</div>';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-user">Username</label>';
        html +=
          '<input id="pl-edit-user" class="input-field" type="text" value="' +
          escapeHtml(p.username || '') +
          '" placeholder="Username" />';
        html += '</div>';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-pass">Password</label>';
        html += '<input id="pl-edit-pass" class="input-field" type="password" placeholder="Password" />';
        html += '</div>';
        html += '<div id="pl-edit-test-status" class="status-info hidden" style="margin-top:12px;"></div>';
        html += '</div>';
        html += '<div class="input-group">';
        html += '<label for="pl-edit-name">Playlist Name</label>';
        html +=
          '<input id="pl-edit-name" class="input-field" type="text" value="' +
          escapeHtml(p.name || '') +
          '" placeholder="My Playlist" />';
        html += '</div>';
        html += '<div class="btn-group">';
        html +=
          '<button id="pl-edit-test" class="btn btn-secondary' +
          (et !== 'xtream' ? ' hidden' : '') +
          '" type="button">Test Login</button>';
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
        html +=
          '<span class="playlist-meta">Added ' +
          formatDate(p.addedAt) +
          ' \u2022 Last played ' +
          (p.lastPlayedAt ? timeAgo(p.lastPlayedAt) : 'Never') +
          '</span>';
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
  html +=
    '<div><div class="toggle-label">Auto quality</div><div class="toggle-desc">Automatically adjust resolution based on bandwidth</div></div>';
  html += '<div class="toggle' + (autoQ ? ' on' : '') + '" id="toggle-autoq"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html +=
    '<div><div class="toggle-label">Auto refresh playlist</div><div class="toggle-desc">Download and update playlist from source on app launch</div></div>';
  html +=
    '<div class="toggle' + (autoRefresh ? ' on' : '') + '" id="toggle-auto-refresh"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html +=
    '<div><div class="toggle-label">Check for updates</div><div class="toggle-desc">Notify when a new version is available (anonymous)</div></div>';
  html +=
    '<div class="toggle' + (updateCheck ? ' on' : '') + '" id="toggle-update-check"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html +=
    '<div><div class="toggle-label">App logo</div><div class="toggle-desc">Show logo and name in the top-left corner</div></div>';
  html += '<div class="toggle' + (watermark ? ' on' : '') + '" id="toggle-watermark"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html +=
    '<div><div class="toggle-label">Quality badge</div><div class="toggle-desc">Show quality and stream type in the top-right corner</div></div>';
  html += '<div class="toggle' + (badge ? ' on' : '') + '" id="toggle-badge"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html +=
    '<div><div class="toggle-label">Proxy menu</div><div class="toggle-desc">Show per-channel proxy option in the sidebar menu</div></div>';
  html += '<div class="toggle' + (proxyMenu ? ' on' : '') + '" id="toggle-proxymenu"><div class="knob"></div></div>';
  html += '</div>';
  html += '<div class="toggle-row">';
  html +=
    '<div><div class="toggle-label">Provider order</div><div class="toggle-desc">List channels in provider order instead of A–Z (applies on next refresh)</div></div>';
  html +=
    '<div class="toggle' + (providerSort ? ' on' : '') + '" id="toggle-channelsort"><div class="knob"></div></div>';
  html += '</div>';
  html += '</div></div>';
  html += renderGroupsCard();
  return html;
}

function groupNames() {
  const map = {};
  for (const ch of getSettings().channels || []) {
    const g = (ch && ch.group) || 'Ungrouped';
    map[g] = (map[g] || 0) + 1;
  }
  return Object.keys(map).sort();
}

function groupChannelCount(name) {
  return (getSettings().channels || []).filter((ch) => ((ch && ch.group) || 'Ungrouped') === name).length;
}

function renderGroupsCard() {
  const hidden = getSettings().hiddenGroups || [];
  const names = groupNames();
  let html = '';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">\u{1F4C1}</span> Groups</h3></div>';
  html += '<div class="card-body">';
  if (names.length === 0) {
    html +=
      '<div class="toggle-row"><div><div class="toggle-label">No groups yet</div><div class="toggle-desc">Load a playlist to manage groups</div></div></div>';
  }
  names.forEach((name, i) => {
    const shown = !hidden.includes(name);
    html += '<div class="toggle-row">';
    html +=
      '<div><div class="toggle-label">' +
      escapeHtml(name) +
      '</div><div class="toggle-desc">' +
      groupChannelCount(name) +
      ' channels</div></div>';
    html += '<div class="toggle' + (shown ? ' on' : '') + '" id="show-group-' + i + '"><div class="knob"></div></div>';
    html += '</div>';
  });
  html += '</div></div>';
  return html;
}

function renderAboutCard() {
  let html = '';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">\u2139</span> About</h3></div>';
  html += '<div class="card-body">';
  html +=
    '<p class="about-text">EN IPTV Player is built for modern IPTV sources, with first-class support for MPD streams and tokenized live channels that other Tizen players drop.</p>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">App</div></div><div class="toggle-value">EN IPTV Player</div></div>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">Version</div></div><div class="toggle-value">' +
    APP_VERSION +
    '</div></div>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">Engine</div></div><div class="toggle-value">Shaka Player</div></div>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">Native playback</div></div><div class="toggle-value">' +
    (player.isNativeAvailable() ? 'Available' : 'Not available') +
    '</div></div>';
  html += '</div></div>';
  html += '<div class="setting-card">';
  html += '<div class="card-header"><h3><span class="card-icon">\u{1F517}</span> Links</h3></div>';
  html += '<div class="card-body">';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">Developer</div></div><div class="toggle-value">Nur-allhi</div></div>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">GitHub</div></div><div class="toggle-value"><a class="about-link" href="https://github.com/Nur-allhi" target="_blank" rel="noopener">github.com/Nur-allhi</a></div></div>';
  html +=
    '<div class="toggle-row"><div><div class="toggle-label">Telegram</div></div><div class="toggle-value"><a class="about-link" href="https://t.me/eniptvplayer" target="_blank" rel="noopener">t.me/eniptvplayer</a></div></div>';
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
    if (state.onPlaylistFetched) state.onPlaylistFetched(channels);
  } catch (e) {
    statusEl.textContent = 'Could not load playlist: ' + e.message;
  } finally {
    if (fetchBtn) fetchBtn.disabled = false;
  }
}
