import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'player', 'dist');
const TIZEN = __dirname;

const PKG = 'IPTVPlayer'; // Must be EXACTLY 10 chars!

// Read app version from player package.json
const playerPkg = JSON.parse(readFileSync(join(ROOT, 'player', 'package.json'), 'utf-8'));
const APP_VERSION = playerPkg.version;

// Get git info for build naming
const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
const versionType = branch === 'main' ? 'stable' : 'beta';
const WGT_NAME = `EN-IPTV_Player_v${APP_VERSION}_${commitHash}.wgt`;
const OUTPUT_DIR = join(ROOT, versionType);
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

function findOpenSSL() {
  const candidates = [
    'openssl',
    '"C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe"',
    '"C:\\Program Files\\OpenSSL-Win32\\bin\\openssl.exe"',
    '"C:\\Program Files\\Git\\usr\\bin\\openssl.exe"',
  ];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} version`, { stdio: 'pipe' });
      return cmd;
    } catch {}
  }
  return null;
}

function findSDB() {
  const candidates = [
    'TizenSdb_v1.1.0.exe',
    '"C:\\Program Files\\TizenSDB\\TizenSdb_v1.1.0.exe"',
  ];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} 2>nul`, { stdio: 'pipe' });
      return cmd;
    } catch {
      try {
        execSync(`${cmd} 2>&1`, { stdio: 'pipe' });
        return cmd;
      } catch {}
    }
  }
  return null;
}

// ─── Step 1: Verify prerequisites ────────────────────────────────────────

const OPENSSL = findOpenSSL();
if (!OPENSSL) {
  console.log('\n OpenSSL not found.\n  winget install OpenSSL.OpenSSL\n');
  process.exit(1);
}

const SDB = findSDB();
if (!SDB) {
  console.log('\n TizenSdb not found — skipping SDB check (packaging only)\n');
}

console.log(` OpenSSL: ${OPENSSL}`);
console.log(` SDB: ${SDB}`);

// ─── Step 2: Ensure dist/ exists ─────────────────────────────────────────

if (!existsSync(DIST)) {
  console.log('\n dist/ not found. Run: npm run build\n');
  process.exit(1);
}

// ─── Step 3: Certificates ────────────────────────────────────────────────

const KEY_FILE = join(TIZEN, 'author-key.pem');
const CERT_FILE = join(TIZEN, 'author-cert.pem');

if (!existsSync(KEY_FILE) || !existsSync(CERT_FILE)) {
  console.log('\n Generating developer certificate...');
  execSync(`${OPENSSL} genrsa -out "${KEY_FILE}" 2048`, { stdio: 'inherit' });
  execSync(
    `${OPENSSL} req -new -x509 -key "${KEY_FILE}" -out "${CERT_FILE}" ` +
    `-days 36500 -subj "/CN=IPTVPlayer/O=Self/OU=Personal"`,
    { stdio: 'inherit' }
  );
} else {
  console.log(' Certificate found');
}

// ─── Step 4: Build and sign the WGT ──────────────────────────────────────

const TEMP = join(TIZEN, 'temp-wgt');
const OUTPUT = join(OUTPUT_DIR, WGT_NAME);
const UNSIGNED = join(TIZEN, 'unsigned.zip');

for (const p of [TEMP, OUTPUT]) {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

console.log('\n Building .wgt...');

// Create temp dir with package structure
mkdirSync(TEMP, { recursive: true });

// Config with 10-char package name
const configXml = `<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns:tizen="http://tizen.org/ns/widgets"
        xmlns="http://www.w3.org/ns/widgets"
        id="https://iptvplayer"
        version="${APP_VERSION}"
        viewmodes="maximized">
  <access origin="*" subdomains="true"/>
  <tizen:application id="${PKG}.IPTV" package="${PKG}" required_version="5.0"/>
  <author href="http://iptvplayer">EN-IPTV Player</author>
  <content src="index.html"/>
  <feature name="http://tizen.org/feature/screen.size.all"/>
  <icon src="icon.png"/>
  <name>EN-IPTV Player v${APP_VERSION}</name>
  <tizen:privilege name="http://tizen.org/privilege/internet"/>
  <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
  <tizen:profile name="tv-samsung"/>
  <tizen:setting screen-orientation="landscape"
                 context-menu="enable"
                 background-support="disable"
                 encryption="disable"
                 install-location="auto"
                 hwkey-event="enable"/>
</widget>`;
writeFileSync(join(TEMP, 'config.xml'), configXml);

// Copy app files
cpSync(DIST, TEMP, { recursive: true });

// Fix paths: strip /enplayer/ base prefix (WGT serves from root)
const htmlPath = join(TEMP, 'index.html');
let html = readFileSync(htmlPath, 'utf-8');
html = html.replace(/\/enplayer\//g, '/');
writeFileSync(htmlPath, html);

// Copy app icon
cpSync(join(TIZEN, 'icons', 'icon_128.png'), join(TEMP, 'icon.png'));

// Create unsigned ZIP via Python helper
const ZIP_HELPER = join(TIZEN, 'ziphelper.py');
execSync(`python "${ZIP_HELPER}" unsigned "${TEMP}" "${UNSIGNED}"`, { stdio: 'inherit' });

if (!existsSync(UNSIGNED)) {
  console.log(' Failed to create unsigned package');
  process.exit(1);
}

// Sign
console.log(' Signing...');
const SIG_FILE = join(TEMP, 'signature.xml');
execSync(
  `${OPENSSL} smime -sign -signer "${CERT_FILE}" -inkey "${KEY_FILE}" ` +
  `-outform DER -binary -in "${UNSIGNED}" -out "${SIG_FILE}"`,
  { stdio: 'inherit' }
);

// Create signed ZIP with signature.xml LAST
execSync(`python "${ZIP_HELPER}" signed "${TEMP}" "${OUTPUT}" "${SIG_FILE}"`, { stdio: 'inherit' });

rmSync(TEMP, { recursive: true, force: true });
rmSync(UNSIGNED, { force: true });

const size = (readFileSync(OUTPUT).length / 1024).toFixed(1);
console.log(`\n Done!  ${WGT_NAME}  (${size} KB)`);
console.log(`   ${OUTPUT}\n`);
