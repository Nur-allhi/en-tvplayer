// OK/Enter handling for settings (T-140).
import { deps } from './deps.js';
import { state } from './state.js';
import { getSettings, saveSettings } from '../config.js';
import * as ui from '../ui/index.js';
import { capabilities } from '../capabilities.js';
import { hasTvKeyInput } from '../lib/capabilities.js';

const onTv = () => hasTvKeyInput(capabilities());

export function selectFocused() {
  const el = document.querySelector('[data-focused]');
  if (!el) return;

  if (el.classList.contains('nav-item')) {
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
    el.classList.add('active');
    state.activeSection = el.dataset.section;
    state.focusIdx = 0;
    deps.render();
    deps.applyFocus();
    return;
  }

  if (el.classList.contains('toggle')) {
    // Trigger the click handler registered in deps.render() — it saves the setting
    // and applies it to the player. (classList.toggle alone never persisted.)
    el.click();
    return;
  }

  if (el.tagName === 'INPUT') {
    // On Tizen the first OK hands focus to the IME so the TV keyboard
    // opens; the second OK advances/saves. Desktop keeps advance-on-Enter.
    if (onTv() && !el.dataset.ime) {
      el.dataset.ime = '1';
      try {
        el.blur();
      } catch {}
      el.focus();
      return;
    }
    delete el.dataset.ime;
    // On TV the remote layer intercepts Enter/OK and routes it here, so the
    // desktop-only keydown Enter handlers never run. Make OK inside a text
    // field act like pressing Enter on a desktop form: advance to the next
    // field, or save from the last field (playlist URL).
    if (el.id === 'pl-add-name') {
      deps.saveAddPlaylist();
    } else if (el.id === 'pl-add-url') {
      deps.moveSettingsFocus('pl-add-name');
    } else if (el.id === 'pl-add-host') {
      deps.moveSettingsFocus('pl-add-user');
    } else if (el.id === 'pl-add-user') {
      deps.moveSettingsFocus('pl-add-pass');
    } else if (el.id === 'pl-add-pass') {
      deps.moveSettingsFocus('pl-add-name');
    } else if (el.id === 'pl-edit-name') {
      deps.saveEditPlaylist();
    } else if (el.id === 'pl-edit-url') {
      deps.moveSettingsFocus('pl-edit-name');
    } else if (el.id === 'pl-edit-host') {
      deps.moveSettingsFocus('pl-edit-user');
    } else if (el.id === 'pl-edit-user') {
      deps.moveSettingsFocus('pl-edit-pass');
    } else if (el.id === 'pl-edit-pass') {
      deps.moveSettingsFocus('pl-edit-name');
    } else {
      el.focus();
    }
    return;
  }

  if (el.id === 'pl-add-btn') {
    state.addMode = true;
    state.addType = 'm3u';
    deps.render();
    deps.applyFocus();
    return;
  }

  // NOTE: only match per-row buttons like "pl-edit-0". The edit form's
  // "pl-edit-save"/"pl-edit-cancel" buttons start with the same prefix and
  // used to be swallowed here, so editing a playlist never saved.
  if (el.id && /^pl-edit-\d+$/.test(el.id)) {
    const idx = parseInt(el.id.split('-')[2], 10);
    const entry = getSettings().playlists[idx];
    state.editMode = true;
    state.editIndex = idx;
    state.editType = entry && entry.type === 'xtream' ? 'xtream' : 'm3u';
    deps.render();
    deps.applyFocus();
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
      deps.render();
      deps.applyFocus();
    });
    return;
  }

  if (el.id === 'pl-add-type-m3u') {
    deps.setFormType('pl-add', 'm3u');
    return;
  }

  if (el.id === 'pl-add-type-xtream') {
    deps.setFormType('pl-add', 'xtream');
    return;
  }

  if (el.id === 'pl-add-test') {
    deps.testXtreamLogin('pl-add');
    return;
  }

  if (el.id === 'pl-edit-type-m3u') {
    deps.setFormType('pl-edit', 'm3u');
    return;
  }

  if (el.id === 'pl-edit-type-xtream') {
    deps.setFormType('pl-edit', 'xtream');
    return;
  }

  if (el.id === 'pl-edit-test') {
    deps.testXtreamLogin('pl-edit');
    return;
  }

  if (el.id === 'pl-add-save') {
    deps.saveAddPlaylist();
    return;
  }

  if (el.id === 'pl-add-cancel') {
    state.addMode = false;
    deps.render();
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      activeEl.blur();
    }
    document.body.focus();
    state.focusIdx = 0;
    deps.applyFocus();
    return;
  }

  if (el.id === 'pl-edit-save') {
    deps.saveEditPlaylist();
    return;
  }

  if (el.id === 'pl-edit-cancel') {
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
    return;
  }

  // OK on a playlist card selects that source AND loads it into the app
  // (same path as the Active button). Mouse click stays select-only.
  if (el.classList.contains('playlist-entry') && el.id && /^playlist-entry-\d+$/.test(el.id)) {
    const idx = parseInt(el.id.split('-')[2], 10);
    const s = getSettings();
    if (idx >= 0 && idx < s.playlists.length && !(state.editMode && state.editIndex === idx)) {
      saveSettings({ activePlaylistIndex: idx });
      deps.render();
      deps.applyFocus();
      deps.handleFetch();
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
