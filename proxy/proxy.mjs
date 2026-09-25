import http from 'http';
import https from 'https';
import os from 'os';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv[2], 10) || 5001;

const logsDir = path.resolve(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, 'proxy.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

const ANSI = { reset: '\x1b[0m', dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', blue: '\x1b[34m', magenta: '\x1b[35m', bold: '\x1b[1m' };
const CAT = {
  INFO:  { label: ' INFO ', ansi: ANSI.blue },
  PROXY: { label: 'PROXY ', ansi: ANSI.cyan },
  WARN:  { label: ' WARN ', ansi: ANSI.yellow },
  ERROR: { label: 'ERROR ', ansi: ANSI.red },
};

function log(message, category = 'INFO') {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const cat = CAT[category] || CAT.INFO;
  const line = `${ts} ${cat.label} │ ${message}`;
  console.log(`${ANSI.dim}${ts}${ANSI.reset} ${cat.ansi}${cat.label}${ANSI.reset} │ ${message}`);
  logStream.write(line + '\n');
}

function getNetworkIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function showBanner(ip, ruleCount) {
  const sep = '─'.repeat(50);
  console.log(`\n${ANSI.bold}╔${sep}╗${ANSI.reset}`);
  console.log(`${ANSI.bold}║${ANSI.reset}  ${ANSI.cyan}${ANSI.bold}EN IPTV — Proxy Server${ANSI.reset}             ${ANSI.bold}║${ANSI.reset}`);
  console.log(`${ANSI.bold}╠${sep}╣${ANSI.reset}`);
  console.log(`${ANSI.bold}║${ANSI.reset}  ${ANSI.green}Local:${ANSI.reset}   https://localhost:${PORT}             ${ANSI.bold}║${ANSI.reset}`);
  console.log(`${ANSI.bold}║${ANSI.reset}  ${ANSI.green}Network:${ANSI.reset} https://${ip}:${PORT}             ${ANSI.bold}║${ANSI.reset}`);
  if (ruleCount > 0) console.log(`${ANSI.bold}║${ANSI.reset}  ${ANSI.dim}Rules:${ANSI.reset}    ${ruleCount}                              ${ANSI.bold}║${ANSI.reset}`);
  console.log(`${ANSI.bold}╚${sep}╝${ANSI.reset}\n`);
  log(`HTTPS → 0.0.0.0:${PORT}`, 'INFO');
  log(`Network: https://${ip}:${PORT}`, 'INFO');
}

// ── Header Rules ───────────────────────────────────────────────
const headerRulesFile = path.resolve(__dirname, 'header-rules.json');
let headerRules = [];
try {
  if (fs.existsSync(headerRulesFile)) {
    const raw = fs.readFileSync(headerRulesFile, 'utf8');
    headerRules = JSON.parse(raw).map(r => ({ ...r, _re: new RegExp(r.match, 'i') }));
    log(`Loaded ${headerRules.length} header rule(s)`, 'INFO');
  } else {
    log('No header-rules.json found — using default headers only', 'WARN');
  }
} catch (e) {
  log(`Failed to load header-rules.json: ${e.message}`, 'ERROR');
}

function applyHeaderRules(hostname, cleanHeaders, url) {
  const dropped = new Set();
  for (const rule of headerRules) {
    if (rule._re.test(hostname)) {
      for (const [k, v] of Object.entries(rule.headers || {})) cleanHeaders[k] = v;
      // Some hosts reject any Origin/Referer (they serve the TV app, which
      // sends none) — drop them even if the browser attached its own.
      for (const k of rule.drop || []) {
        const lk = String(k).toLowerCase();
        dropped.add(lk);
        delete cleanHeaders[lk];
      }
      log(`  └─ matched rule "${rule.name}"`);
      break;
    }
  }
  if (!dropped.has('origin') && !cleanHeaders['origin']) cleanHeaders['origin'] = url.protocol + '//' + url.hostname;
  if (!dropped.has('referer') && !cleanHeaders['referer']) cleanHeaders['referer'] = url.protocol + '//' + url.hostname + '/';
  return null;
}
// ──────────────────────────────────────────────────────────────

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 50 });

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT EXCEPTION: ${err.message}`, 'ERROR');
  log(`  ${err.stack?.split('\n').slice(1, 3).join(' ')}`, 'ERROR');
});
process.on('unhandledRejection', (err) => {
  log(`UNHANDLED REJECTION: ${err?.message || err}`, 'ERROR');
});

// ── Self-signed certificate for HTTPS ──────────────────────────
async function ensureCert() {
  const certDir = path.resolve(__dirname, '..', 'certs');
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });
  const keyPath = path.join(certDir, 'proxy.key');
  const certPath = path.join(certDir, 'proxy.cert');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath, 'utf8'), cert: fs.readFileSync(certPath, 'utf8') };
  }
  log('Generating self-signed certificate for HTTPS...', 'INFO');
  const selfsigned = await import('selfsigned');
  const s = selfsigned.default || selfsigned;
  const ip = getNetworkIp();
  const altNames = [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }];
  if (ip !== '127.0.0.1' && ip !== 'localhost') altNames.push({ type: 7, ip });
  const pems = await s.generate(
    [{ name: 'commonName', value: 'localhost' }, { name: 'organizationName', value: 'EN IPTV Proxy' }],
    { days: 3650, keySize: 2048, extensions: [{ name: 'subjectAltName', altNames }] }
  );
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  log('Certificate generated: ' + certPath, 'INFO');
  return { key: pems.private, cert: pems.cert };
}

// ── Start ──────────────────────────────────────────────────────
async function start() {
  const tls = await ensureCert();
  const handler = createHandler();

  // Status page handler
  function statusHandler(req, res) {
    const rawUrl = req.url;
    if (rawUrl === '/' || rawUrl === '') {
      const ip = getNetworkIp();
      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>EN Proxy</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#c9d1d9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
.card{text-align:center;max-width:400px}
h1{font-size:24px;margin:0 0 8px 0;color:#fff}
.status{display:inline-block;margin-top:12px;padding:4px 16px;border-radius:20px;background:#23863633;color:#3fb950;font-size:14px}
.url{color:#58a6ff;font-family:monospace;margin:16px 0;font-size:15px}
.hint{color:#8b949e;font-size:13px}
</style></head>
<body><div class="card">
<h1>🔌 Proxy Server</h1>
<div class="status">● Running</div>
<div class="url">https://${ip}:${PORT}</div>
<div class="hint">Desktop testing relay — prefix channel URLs with this address.</div>
</div></body></html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html) });
      res.end(html);
      return;
    }
    handler(req, res);
  }

  https.createServer(tls, statusHandler).listen(PORT, () => {
    const ip = getNetworkIp();
    showBanner(ip, headerRules.length);
  }).on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n Port ${PORT} already in use — is another proxy running?`);
      process.exit(1);
    }
    throw e;
  });
}

function createHandler() {
  return async (req, res) => {
    const rawUrl = req.url;
    const method = req.method;

    try {
      const target = rawUrl.slice(1);
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        res.writeHead(400); res.end('Invalid proxy URL. Usage: http://proxy:PORT/http://target.url/stream');
        return;
      }

      const url = new URL(target);
      const mod = url.protocol === 'https:' ? https : http;
      const blockedHeaders = ['host', 'connection', 'keep-alive'];
      const cleanHeaders = Object.fromEntries(
        Object.entries(req.headers).filter(([k]) => !blockedHeaders.includes(k.toLowerCase()))
      );
      // Parse |referer=... suffix from URL path and set as referer header
      const pipeIdx = url.pathname.indexOf('%7Creferer=');
      if (pipeIdx !== -1) {
        const refValue = url.pathname.slice(pipeIdx + 11);
        cleanHeaders.referer = decodeURIComponent(refValue);
        url.pathname = url.pathname.slice(0, pipeIdx);
      }
      applyHeaderRules(url.hostname, cleanHeaders, url);
      if (!cleanHeaders['user-agent']) {
        cleanHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
      }

      log(`${method} ${url.hostname}${url.pathname.slice(0, 80)}`, 'PROXY');
      log(`Headers: ${JSON.stringify({referer: cleanHeaders.referer, origin: cleanHeaders.origin, 'user-agent': (cleanHeaders['user-agent']||'').slice(0,50)})}`, 'INFO');

      let responded = false;
      req.setTimeout(30000, () => { if (!responded) { log(`Timeout ${url.hostname}`, 'WARN'); req.destroy(); } });

      const cleanTarget = url.href;
      const proxyReq = mod.request(cleanTarget, {
        method,
        agent: url.protocol === 'https:' ? httpsAgent : undefined,
        headers: { ...cleanHeaders, host: url.hostname },
        timeout: 15000,
      }, (proxyRes) => {
        responded = true;
        log(`${proxyRes.statusCode} ${url.hostname}${url.pathname.slice(0, 60)}`, proxyRes.statusCode >= 400 ? 'WARN' : 'INFO');
        res.writeHead(proxyRes.statusCode, {
          'Access-Control-Allow-Origin': '*',
          ...Object.fromEntries(
            Object.entries(proxyRes.headers).filter(([k]) => !/^access-control-allow-origin$/i.test(k))
          ),
        });
        const cleanup = () => { proxyRes.destroy(); res.destroy(); };
        res.on('error', (e) => { if (e.message === 'aborted') return; log(`Response error: ${e.message}`, 'ERROR'); cleanup(); });
        proxyRes.on('error', (e) => { if (e.message === 'aborted') return; log(`Upstream error: ${e.message}`, 'ERROR'); cleanup(); });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (e) => { if (e.message.includes('certificate')) return; log(`Request error: ${e.message}`, 'ERROR'); if (!responded) { responded = true; res.writeHead(502); res.end('Proxy error: ' + e.message); } });
      proxyReq.on('timeout', () => { if (!responded) { proxyReq.destroy(); responded = true; res.writeHead(504); res.end('Proxy timeout'); } });
      req.on('error', (e) => { log(`Client error: ${e.message}`, 'ERROR'); proxyReq.destroy(); });
      req.pipe(proxyReq, { end: true });
    } catch (e) {
      log(`Server error: ${e.message}`, 'ERROR');
      if (!res.headersSent) { res.writeHead(500); res.end('Server error'); }
    }
  };
}

start().catch(e => { console.error('Proxy startup failed:', e); process.exit(1); });
