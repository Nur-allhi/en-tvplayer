// Movies / Series browser (T-182). Renders into the group-list container so
// the sidebar stays the single navigation surface. All decisions about levels
// live in lib/library-nav.js; this file only renders and delegates input.

import { escapeHtml } from '../utils.js';
import { getLibrary, loadLibrary } from '../state/vod.js';
import { LEVELS, initialNav, current, move, select, back } from '../lib/library-nav.js';
import { deps } from './deps.js';
import { state } from './state.js';

let nav = initialNav();

const container = () => document.getElementById('group-list');

const library = () => {
  loadLibrary();
  return getLibrary();
};

const itemsFor = (type) => library().filter((item) => item.type === type);

function context() {
  const frame = current(nav);
  if (frame.level === LEVELS.LIST) {
    const items = itemsFor(frame.selected);
    return { listCount: items.length, mediaIdAt: (i) => items[i]?.id };
  }
  if (frame.level === LEVELS.DETAIL) {
    const media = library().find((item) => item.id === frame.selected);
    return {
      selectedType: media?.type,
      episodeCount: media?.episodes?.length || 0,
    };
  }
  return {};
}

function rows() {
  const frame = current(nav);
  if (frame.level === LEVELS.ROOT) {
    return [
      { label: '🎬 Movies', count: itemsFor('movie').length },
      { label: '📺 Series', count: itemsFor('series').length },
    ];
  }
  if (frame.level === LEVELS.LIST) {
    return itemsFor(frame.selected).map((item) => ({
      label: item.title,
      count: item.year || '',
    }));
  }
  if (frame.level === LEVELS.DETAIL) {
    const media = library().find((item) => item.id === frame.selected);
    const rows = [{ label: '▶ Play', count: '' }];
    if (media?.type === 'series' && media.episodes?.length) {
      rows.push({ label: '📺 Episodes', count: media.episodes.length });
    }
    return rows;
  }
  const media = library().find((item) => item.id === frame.selected);
  return (media?.episodes || []).map((ep) => ({
    label: `S${ep.season}E${ep.number} ${ep.title}`,
    count: ep.resumeAt ? '⏵' : '',
  }));
}

function render() {
  const el = container();
  if (!el) return;
  el.innerHTML = '';
  const frame = current(nav);
  rows().forEach((row, index) => {
    const item = document.createElement('div');
    item.className = 'group-item' + (index === frame.index ? ' focused' : '');
    item.innerHTML =
      '<span class="group-name">' +
      escapeHtml(row.label) +
      '</span>' +
      (row.count !== '' ? '<span class="group-count">(' + escapeHtml(String(row.count)) + ')</span>' : '');
    el.appendChild(item);
  });
  const title = document.getElementById('sidebar-title');
  if (title) title.textContent = frame.level === LEVELS.ROOT ? 'Library' : 'Library · Back to go up';
  const focused = el.children[frame.index];
  if (focused) focused.scrollIntoView({ block: 'nearest', behavior: 'auto' });
}

export function enterLibrary() {
  nav = initialNav();
  state.sidebarMode = 'library';
  const groupList = container();
  const channelList = document.getElementById('channel-list');
  if (channelList) channelList.classList.add('hidden');
  if (groupList) groupList.classList.remove('hidden');
  render();
}

export function exitLibrary() {
  nav = initialNav();
  state.sidebarMode = 'groups';
  deps.renderGroupList();
  deps.updateSidebarTitle();
}

export function libraryNavigate(delta) {
  nav = move(nav, delta, context());
  render();
}

export function librarySelect() {
  const next = select(nav, context());
  if (next === nav) return;
  nav = next;
  render();
}

export function libraryBack() {
  const out = back(nav);
  nav = out;
  if (out.exit) {
    exitLibrary();
    return;
  }
  render();
}
