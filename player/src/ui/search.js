// Cross-group search (T-037), extracted in T-133. ui.js re-exports the public
// names so callers keep using ui.*. Calls into the group-list slice and the
// channel core go through deps.js, which ui.js wires at boot — this keeps the
// slice from importing the re-export hub and creating a cycle.

import { escapeHtml } from '../utils.js';
import { getHiddenGroups } from '../config.js';
import { state } from './state.js';
import { deps } from './deps.js';

const SEARCH_LIMIT = 60;

function getSearchInput() {
  return document.getElementById('channel-search');
}

function isSearchInputFocused() {
  const el = getSearchInput();
  return !!el && document.activeElement === el;
}

export function computeSearchResults() {
  const q = state.searchQuery.trim().toLowerCase();
  if (!q) return [];
  const hidden = getHiddenGroups();
  return state.channels.filter(
    (ch) => !hidden.includes((ch && ch.group) || 'Ungrouped') && (ch.name || '').toLowerCase().includes(q),
  );
}

export function enterSearch() {
  state.sidebarMode = 'search';
  state.searchQuery = '';
  state.searchResults = [];
  state.searchFocus = 0;
  renderSearch();
  deps.updateSidebarTitle();
}

export function exitSearch() {
  state.sidebarMode = 'groups';
  state.searchQuery = '';
  state.searchResults = [];
  state.searchFocus = 0;
  const groupList = document.getElementById('group-list');
  const channelList = document.getElementById('channel-list');
  if (channelList) channelList.classList.add('hidden');
  if (groupList) groupList.classList.remove('hidden');
  deps.renderGroupList();
  deps.updateSidebarTitle();
}

function renderSearch() {
  const container = document.getElementById('group-list');
  if (!container) return;
  const channelList = document.getElementById('channel-list');
  if (channelList) channelList.classList.add('hidden');
  container.classList.remove('hidden');
  container.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'search-row';
  const input = document.createElement('input');
  input.id = 'channel-search';
  input.className = 'input-field';
  input.type = 'text';
  input.placeholder = 'Search channels…';
  input.setAttribute('autocomplete', 'off');
  input.value = state.searchQuery;
  input.addEventListener('input', () => {
    state.searchQuery = input.value;
    state.searchResults = computeSearchResults();
    state.searchFocus = 0;
    renderSearchResults();
  });
  row.appendChild(input);
  container.appendChild(row);
  const results = document.createElement('div');
  results.id = 'search-results';
  container.appendChild(results);
  renderSearchResults();
  input.focus();
}

function searchHint(text) {
  const el = document.createElement('div');
  el.className = 'search-hint';
  el.textContent = text;
  return el;
}

export function renderSearchResults() {
  const box = document.getElementById('search-results');
  if (!box) return;
  box.innerHTML = '';
  if (!state.searchQuery.trim()) {
    box.appendChild(searchHint('Type to search all groups'));
    return;
  }
  if (state.searchResults.length === 0) {
    box.appendChild(searchHint('No channels found'));
    return;
  }
  state.searchResults.slice(0, SEARCH_LIMIT).forEach((ch, i) => {
    const item = document.createElement('div');
    item.className = 'channel-item search-item';
    item.innerHTML =
      '<span class="channel-name"><span class="channel-name-text">' +
      escapeHtml(ch.name) +
      '</span></span>' +
      '<span class="group-count">' +
      escapeHtml(ch.group || 'Ungrouped') +
      '</span>';
    item.addEventListener('click', () => {
      state.searchFocus = i;
      updateSearchFocus();
      searchSelect();
    });
    box.appendChild(item);
  });
  if (state.searchResults.length > SEARCH_LIMIT) {
    box.appendChild(searchHint('+' + (state.searchResults.length - SEARCH_LIMIT) + ' more — keep typing'));
  }
  updateSearchFocus();
}

function updateSearchFocus() {
  const items = document.querySelectorAll('#search-results .search-item');
  items.forEach((item, i) => item.classList.toggle('focused', i === state.searchFocus));
  if (items[state.searchFocus]) {
    // Instant + minimal scroll: see updateGroupFocus.
    items[state.searchFocus].scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
}

export function searchNavigate(dir) {
  if (isSearchInputFocused()) {
    if (dir > 0 && state.searchResults.length > 0) {
      getSearchInput().blur();
      state.searchFocus = 0;
      updateSearchFocus();
    }
    return;
  }
  if (state.searchResults.length === 0) return;
  state.searchFocus += dir;
  if (state.searchFocus < 0) {
    state.searchFocus = 0;
    const input = getSearchInput();
    if (input) input.focus();
    updateSearchFocus();
    return;
  }
  const shown = Math.min(state.searchResults.length, SEARCH_LIMIT);
  if (state.searchFocus >= shown) state.searchFocus = shown - 1;
  updateSearchFocus();
}

export function searchSelect() {
  if (isSearchInputFocused()) {
    if (state.searchResults.length === 0) return;
    getSearchInput().blur();
    state.searchFocus = 0;
    updateSearchFocus();
    return;
  }
  const ch = state.searchResults[state.searchFocus];
  if (!ch) return;
  const idx = state.channels.indexOf(ch);
  exitSearch();
  if (idx >= 0) deps.selectChannel(idx);
}
