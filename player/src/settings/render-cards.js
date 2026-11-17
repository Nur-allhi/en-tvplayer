import { state } from './state.js';
import { getSettings, APP_VERSION } from '../config.js';
import { escapeHtml } from '../utils.js';
import * as player from '../player/index.js';
import { timeAgo, formatDate } from '../lib/time.js';
import { MAX_PLAYLISTS } from './state.js';

export function renderSourceCard(s, lastFetched) {
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

export function renderPlaybackCard() {
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

export function renderGroupsCard() {
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

export function groupNames() {
  const map = {};
  for (const ch of getSettings().channels || []) {
    const g = (ch && ch.group) || 'Ungrouped';
    map[g] = (map[g] || 0) + 1;
  }
  return Object.keys(map).sort();
}

export function groupChannelCount(name) {
  return (getSettings().channels || []).filter((ch) => ((ch && ch.group) || 'Ungrouped') === name).length;
}

export function renderAboutCard() {
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
