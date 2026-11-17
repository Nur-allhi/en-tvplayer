import { deps } from './deps.js';
import { state } from './state.js';
import { getSettings, saveSettings, APP_VERSION } from '../config.js';
import * as ui from '../ui/index.js';
import { bindPlaybackToggles } from './playback.js';
import { renderSourceCard, renderPlaybackCard } from './render-cards.js';
import { renderAboutCard } from './about.js';
import { renderVodAddCard } from './media.js';
import { timeAgo } from '../lib/time.js';
import { NAV_ITEMS } from './state.js';

export function render() {
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
    mainHtml += renderVodAddCard();
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
        deps.saveAddPlaylist();
      });
    }
    const addTypeM3u = document.getElementById('pl-add-type-m3u');
    if (addTypeM3u) {
      addTypeM3u.addEventListener('click', () => deps.setFormType('pl-add', 'm3u'));
    }
    const addTypeXtream = document.getElementById('pl-add-type-xtream');
    if (addTypeXtream) {
      addTypeXtream.addEventListener('click', () => deps.setFormType('pl-add', 'xtream'));
    }
    const addTestBtn = document.getElementById('pl-add-test');
    if (addTestBtn) {
      addTestBtn.addEventListener('click', () => deps.testXtreamLogin('pl-add'));
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
        deps.saveEditPlaylist();
      });
    }
    const editTypeM3u = document.getElementById('pl-edit-type-m3u');
    if (editTypeM3u) {
      editTypeM3u.addEventListener('click', () => deps.setFormType('pl-edit', 'm3u'));
    }
    const editTypeXtream = document.getElementById('pl-edit-type-xtream');
    if (editTypeXtream) {
      editTypeXtream.addEventListener('click', () => deps.setFormType('pl-edit', 'xtream'));
    }
    const editTestBtn = document.getElementById('pl-edit-test');
    if (editTestBtn) {
      editTestBtn.addEventListener('click', () => deps.testXtreamLogin('pl-edit'));
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
    // The fetch button exists only in the playlist list, not in add/edit form
    // mode. Every other listener in this branch is null-guarded; this one was
    // not, so a first-run "Add your source" click threw after rendering the
    // form (T-211).
    const fetchBtn = document.getElementById('settings-fetch-btn');
    if (fetchBtn) fetchBtn.addEventListener('click', () => deps.handleFetch());
  } else if (state.activeSection === 'playback') {
    bindPlaybackToggles();
  } else {
    const copyBtn = document.getElementById('about-copy-diagnostics');
    if (copyBtn) copyBtn.addEventListener('click', () => deps.copyDiagnostics());
    const addBtn = document.getElementById('vod-add-btn');
    if (addBtn) addBtn.addEventListener('click', () => deps.importMediaSource());
  }

  if (typeof state.onRender === 'function') state.onRender();
}
