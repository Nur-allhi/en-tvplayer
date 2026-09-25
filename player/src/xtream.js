// Native Xtream Codes login (T-038, Live TV only — VOD/series out of scope).
// Maps categories → group and live streams → channels in provider num order.

function baseHost(host) {
  return String(host || '').trim().replace(/\/+$/, '');
}

function apiUrl(entry, params) {
  const q = new URLSearchParams({ username: entry.username, password: entry.password, ...params });
  return baseHost(entry.host) + '/player_api.php?' + q.toString();
}

async function getJson(url, ms = 10000) {
  let resp;
  try {
    resp = await Promise.race([
      fetch(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
  } catch (e) {
    throw new Error('Could not reach the Xtream server. Please check the host and your internet connection.');
  }
  if (!resp.ok) throw new Error('Server returned error ' + resp.status);
  try {
    return await resp.json();
  } catch {
    throw new Error('The server did not answer like an Xtream panel. Please check the host.');
  }
}

// Validates credentials. Resolves { user, server } or throws a plain message.
export async function login(entry) {
  if (!entry || !baseHost(entry.host) || !entry.username || !entry.password) {
    throw new Error('Please fill in host, username and password.');
  }
  const data = await getJson(apiUrl(entry, {}));
  const info = (data && data.user_info) || {};
  if (String(info.auth) !== '1') {
    throw new Error('Invalid username or password.');
  }
  if (info.exp_date && Number(info.exp_date) * 1000 < Date.now()) {
    throw new Error('This Xtream line has expired.');
  }
  return { user: info, server: (data && data.server_info) || {} };
}

export async function fetchXtreamChannels(entry) {
  await login(entry);
  const host = baseHost(entry.host);
  const [cats, streams] = await Promise.all([
    getJson(apiUrl(entry, { action: 'get_live_categories' })),
    getJson(apiUrl(entry, { action: 'get_live_streams' })),
  ]);
  const names = {};
  for (const c of Array.isArray(cats) ? cats : []) {
    if (c && c.category_id != null) names[String(c.category_id)] = c.category_name || 'Ungrouped';
  }
  const list = (Array.isArray(streams) ? streams : [])
    .filter(s => s && s.stream_id != null)
    .sort((a, b) => (Number(a.num) || 0) - (Number(b.num) || 0));
  return list.map((s, index) => ({
    name: s.name || ('Channel ' + (index + 1)),
    url: host + '/live/' + encodeURIComponent(entry.username) + '/' +
      encodeURIComponent(entry.password) + '/' + s.stream_id + '.m3u8',
    channelNumber: Number(s.num) > 0 ? Number(s.num) : index + 1,
    drm: null,
    userAgent: null,
    customHeaders: null,
    authQuery: null,
    group: names[String(s.category_id)] || 'Ungrouped',
  }));
}
