import { deps } from './deps.js';
import { state } from './state.js';
import { getSettings, saveSettings, getActivePlaylist } from '../config.js';
import { fetchPlaylistEntry } from '../utils.js';
import { login as xtreamLogin } from '../xtream.js';
import { MAX_PLAYLISTS } from './state.js';

export function saveAddPlaylist() {
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
  deps.render();
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    activeEl.blur();
  }
  document.body.focus();
  state.focusIdx = 0;
  deps.applyFocus();
}

export function valOf(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

export function saveEditPlaylist() {
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
  deps.render();
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    activeEl.blur();
  }
  document.body.focus();
  state.focusIdx = 0;
  deps.applyFocus();
}

export function setFormType(prefix, type) {
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

export async function testXtreamLogin(prefix) {
  const statusEl = document.getElementById(prefix + '-test-status');
  const host = valOf(prefix + '-host');
  const username = valOf(prefix + '-user');
  const passEl = document.getElementById(prefix + '-pass');
  const password = passEl ? passEl.value : '';
  if (statusEl) {
    statusEl.classList.remove('hidden', 'is-success', 'is-error');
    statusEl.textContent = 'Checking...';
  }
  try {
    await xtreamLogin({ host, username, password });
    if (statusEl) {
      statusEl.classList.add('is-success');
      statusEl.textContent = 'Login OK — save to load channels';
    }
  } catch (e) {
    if (statusEl) {
      statusEl.classList.add('is-error');
      statusEl.textContent = e.message;
    }
  }
}

export async function handleFetch() {
  const fetchBtn = document.getElementById('settings-fetch-btn');
  const statusEl = document.getElementById('settings-fetch-status');
  if (!statusEl) return;
  const active = getActivePlaylist();
  if (!active || (active.type !== 'xtream' && !active.url)) {
    statusEl.className = 'status-info is-error';
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
    statusEl.classList.add('is-success');
    statusEl.textContent = 'Fetched ' + channels.length + ' channels';
    if (state.onPlaylistFetched) state.onPlaylistFetched(channels);
  } catch (e) {
    statusEl.classList.add('is-error');
    statusEl.textContent = 'Could not load playlist: ' + e.message;
  } finally {
    if (fetchBtn) fetchBtn.disabled = false;
  }
}
