# RPXLABS Finance — Web Dashboard

Dashboard keuangan pribadi RPXLABS. Statis di Vercel, data dari Google Apps Script.

## Cara kerja

```
Browser (Vercel)
   |  PIN (POST)
   v
Apps Script /exec?action=pintuPost  ->  token sesi 12 jam (HMAC)
   |
   |  JSONP ?action=api&t=token&callback=...
   v
Apps Script /exec?action=api  ->  JSON data keuangan
```

**Kenapa JSONP?** Apps Script `ContentService` tidak bisa menyetel header
`Access-Control-Allow-Origin`, jadi `fetch()` biasa diblokir CORS. JSONP
melewati batasan itu tanpa perlu proxy.

**Kenapa dashboard tidak lagi di Apps Script?** `HtmlService` menyajikan
HTML lewat iframe sandbox berlapis tiga, dan untuk HTML sebesar 20 KB
iframe terakhir kadang tidak terisi (layar putih). Vercel menyajikan file
statis langsung — tidak ada sandbox, tidak mungkin putih.

## Struktur

| Berkas | Isi |
|---|---|
| `index.html` | Kerangka halaman |
| `style.css` | Semua gaya — hitam murni, teks cream, aksen hanya hijau/merah nominal |
| `app.js` | Logika: PIN, token, ambil data, gambar grafik |
| `api/config.js` | Serverless function: mengirim `APPS_SCRIPT_URL` ke browser |
| `vercel.json` | Setelan Vercel: header keamanan |

## Environment Variable

Satu variabel wajib di Vercel:

| Nama | Nilai |
|---|---|
| `APPS_SCRIPT_URL` | URL `/exec` Apps Script, contoh `https://script.google.com/macros/s/AKfy.../exec` |

Tanpa variabel ini halaman menampilkan pesan galat, bukan layar putih.

## Warna

| Nama | Kode | Dipakai untuk |
|---|---|---|
| Latar | `#000` | Seluruh halaman |
| Teks | `#f0f0f0` | Teks utama |
| Redup | `#7c7c8a` | Label, metadata |
| Pemasukan | `#4ade80` | **Hanya** nominal masuk |
| Pengeluaran | `#f87171` | **Hanya** nominal keluar |

Tidak ada warna aksen lain. Tidak ada lime. Tidak ada mode terang.

## Menjalankan lokal

Butuh Node.js. Tidak butuh dependensi.

```bash
node dev-server.js
```

Buka `http://127.0.0.1:8900`.

## Deploy

1. Push repo ke GitHub
2. Vercel → Add New Project → import repo
3. Settings → Environment Variables → tambah `APPS_SCRIPT_URL`
4. Deploy

## Keamanan

- PIN di Apps Script, **bukan** di kode web. PIN tidak ada di repo.
- Token sesi ditandatangani HMAC-SHA256, umur 12 jam, tidak bisa dipalsukan.
- PIN dikirim lewat POST, tidak pernah masuk URL.
- `APPS_SCRIPT_URL` hanya ada di environment variable Vercel, tidak di repo.
- Token disimpan di `localStorage`, hilang saat sesi habis.
