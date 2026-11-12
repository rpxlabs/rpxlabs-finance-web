/* Vercel serverless function: mengirim URL Apps Script + setelan ke browser.
 *
 * Kenapa lewat sini dan bukan langsung di index.html?
 * Supaya URL Apps Script tidak ditulis mati di repo. Nilai asli disimpan
 * di Environment Variable Vercel: APPS_SCRIPT_URL.
 *
 * Hasil: GET /api/config  ->  { APPS_SCRIPT_URL: "...", ... }
 */
module.exports = function handler(req, res) {
  const url = process.env.APPS_SCRIPT_URL || '';

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const aman = String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  res.status(200).send(
    'window.RPX_CONFIG = {\n' +
    '  APPS_SCRIPT_URL: "' + aman + '",\n' +
    '  TOKEN_KEY: "rpxlabs_finance_token",\n' +
    '  TOKEN_UMUR_MS: ' + (12 * 60 * 60 * 1000) + '\n' +
    '};\n'
  );
};
