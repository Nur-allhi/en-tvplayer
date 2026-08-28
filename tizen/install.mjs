import { createReadStream, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { request } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const ip = process.argv.find(a => a.startsWith('--ip='))?.split('=')[1];

if (!ip) {
  console.log('\n Install the .wgt to your Samsung TV via Developer Mode.\n');
  console.log(' Usage:   node install.mjs --ip=192.168.x.x\n');
  console.log(' Make sure Developer Mode app is running on your TV.\n');
  console.log(' TV steps:');
  console.log('   1. Open Apps -> Search "Developer Mode" -> Install & open it');
  console.log('   2. Note the IP address shown on TV');
  console.log('   3. Run this script with that IP\n');
  process.exit(1);
}

const wgtFiles = readdirSync(ROOT).filter(f => f.endsWith('.wgt'));
if (wgtFiles.length === 0) {
  console.log('\n No .wgt file found in project root.');
  console.log(' Run: npm run tizen\n');
  process.exit(1);
}
const WGT = join(ROOT, wgtFiles[wgtFiles.length - 1]);

const size = (statSync(WGT).size / 1024).toFixed(1);
console.log(`\n Uploading ${wgtFiles[wgtFiles.length - 1]} (${size} KB) to ${ip}...`);

// Samsung Developer Mode uses HTTP POST with multipart/form-data
// on port 8001 by default
const boundary = '----IPTVUpload' + Date.now();

const fileData = createReadStream(WGT);
const fileBuffer = await new Promise((resolve, reject) => {
  const chunks = [];
  fileData.on('data', c => chunks.push(c));
  fileData.on('end', () => resolve(Buffer.concat(chunks)));
  fileData.on('error', reject);
});

const body = Buffer.concat([
  Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="IPTV-Player.wgt"\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`
  ),
  fileBuffer,
  Buffer.from(`\r\n--${boundary}--\r\n`),
]);

const options = {
  hostname: ip,
  port: 8001,
  path: '/upload',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length,
  },
};

const req = request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log(' Installed successfully!\n');
      console.log(' On your TV, go to Apps -> My Apps -> IPTV Player\n');
    } else {
      console.log(` Server responded: ${res.statusCode} ${res.message}`);
      if (data) console.log(` Response: ${data}`);
    }
  });
});

req.on('error', (err) => {
  console.log(`\n Connection failed: ${err.message}\n`);
  console.log(' Possible issues:');
  console.log('   - TV not on same network as PC');
  console.log('   - Developer Mode app not running on TV');
  console.log('   - Wrong IP address');
  console.log('   - Firewall blocking port 8001\n');
});

req.write(body);
req.end();
