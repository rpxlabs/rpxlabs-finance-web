/* Server lokal untuk mencoba dashboard sebelum deploy.
 * Jalankan: node dev-server.js
 * Buka   : http://127.0.0.1:8900
 *
 * APPS_SCRIPT_URL dibaca dari environment variable atau isi manual di
 * const URL_ASLI di bawah.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8900;
const URL_ASLI = process.env.APPS_SCRIPT_URL || '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');

  if (u.pathname === '/api/config') {
    const aman = String(URL_ASLI).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0'
    });
    res.end(
      'window.RPX_CONFIG = {\n' +
      '  APPS_SCRIPT_URL: "' + aman + '",\n' +
      '  TOKEN_KEY: "rpxlabs_finance_token",\n' +
      '  TOKEN_UMUR_MS: 43200000\n' +
      '};\n'
    );
    return;
  }

  let f = u.pathname === '/' ? '/index.html' : u.pathname;
  const full = path.join(ROOT, f);
  const akar = path.resolve(ROOT);
  if (!path.resolve(full).startsWith(akar)) { res.writeHead(403); res.end('403'); return; }
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); res.end('404'); return; }

  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  res.end(fs.readFileSync(full));
}).listen(PORT, () => {
  console.log('RPXLABS Finance dev server');
  console.log('buka http://127.0.0.1:' + PORT);
  if (!URL_ASLI) console.log('PERINGATAN: APPS_SCRIPT_URL kosong. Set dulu supaya data bisa diambil.');
});
