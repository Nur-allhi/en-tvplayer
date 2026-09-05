# Telemetry (opt-in only)

The app asks once on first launch: "Check for app updates on launch?"
Default is **off**. The choice lives in Settings → Playback → "Check for
updates" and can be revoked anytime. Declining disables all network activity
described here.

## What is sent (only when opted in)

| Data | Purpose |
|------|---------|
| Update check: GET of a static `version.json` via jsDelivr CDN | Learn whether a newer release exists |
| Usage ping: app version + `tizen`/`browser` device class | Count active installs per version |

No IP addresses are stored by us, no identifiers, no viewing data, no playlist
URLs. The CDN (jsDelivr) sees the requesting IP as with any download — same as
fetching a playlist.

## Status: ping endpoint not deployed

`player/src/update.js` ships with `PING_URL = ''`. With it empty, the ping is
a no-op and only the update check runs. To enable install counting, deploy
this Cloudflare Worker (free tier) with a KV namespace named `COUNTS`:

```js
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const v = url.searchParams.get('v') || 'unknown';
    const tv = url.searchParams.get('tv') || 'unknown';
    const key = `installs:${v}:${tv}`;
    const count = (await env.COUNTS.get(key)) || '0';
    await env.COUNTS.put(key, String(Number(count) + 1));
    return new Response('ok');
  },
};
```

Then set `PING_URL` to the worker URL and note the deploy date below.

## Deploy log

| Date | Change |
|------|--------|
| — | Ping endpoint not yet deployed |
