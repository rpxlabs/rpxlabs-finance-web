/* RPXLABS Finance — dashboard.
 *
 * Alur:
 *   1. Pin masuk  -> POST ke Apps Script (?action=pintuPost) -> dapat token
 *   2. Token disimpan di localStorage, umur 12 jam
 *   3. Data diambil lewat JSONP (?action=api&t=token&callback=...)
 *
 * JSONP dipakai karena Apps Script (ContentService) tidak bisa mengirim
 * header CORS, jadi fetch() biasa akan diblokir browser.
 */
(function () {
  'use strict';

  var CFG = window.RPX_CONFIG || {};
  var EL = CFG.APPS_SCRIPT_URL || '';
  var TOKEN_KEY = CFG.TOKEN_KEY || 'rpxlabs_finance_token';
  var UMUR = CFG.TOKEN_UMUR_MS || 12 * 60 * 60 * 1000;

  var $ = function (id) { return document.getElementById(id); };

  // ---------- format ----------
  function rp(n) {
    var neg = n < 0;
    var s = Math.abs(Math.round(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-Rp ' : 'Rp ') + s;
  }
  function rpRingkas(n) {
    n = Math.round(n || 0);
    if (Math.abs(n) >= 1000000) return 'Rp ' + (n / 1000000).toFixed(1).replace('.', ',') + 'jt';
    if (Math.abs(n) >= 1000) return 'Rp ' + Math.round(n / 1000) + 'rb';
    return rp(n);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- token ----------
  function simpanToken(t) {
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ t: t, exp: Date.now() + UMUR }));
    } catch (e) { /* mode privat */ }
  }
  function ambilToken() {
    try {
      var raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.t || !o.exp || o.exp < Date.now()) {
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return o.t;
    } catch (e) { return null; }
  }
  function hapusToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* abaikan */ }
  }

  // ---------- layar ----------
  function tampilGerbang(pesan) {
    $('gerbang').hidden = false;
    $('isi').hidden = true;
    $('galat').hidden = true;
    var el = $('gerbangSalah');
    el.textContent = pesan || '';
    el.className = pesan ? 'gerbang-salah tampil' : 'gerbang-salah';
    var inp = $('pinInput');
    inp.value = '';
    if (pesan) inp.focus();
  }
  function tampilIsi() {
    $('gerbang').hidden = true;
    $('galat').hidden = true;
    $('isi').hidden = false;
  }
  function tampilGalat(pesan) {
    $('gerbang').hidden = true;
    $('isi').hidden = true;
    $('galat').hidden = false;
    $('galatPesan').textContent = pesan || 'Terjadi kesalahan.';
  }

  // ---------- JSONP ----------
  var urutCallback = 0;
  function jsonp(params, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (!EL) { reject(new Error('URL Apps Script belum diisi (APPS_SCRIPT_URL).')); return; }

      var nama = 'rpxCb' + (++urutCallback) + '_' + Date.now();
      var skrip = document.createElement('script');
      var selesai = false;
      var jam = setTimeout(function () {
        if (selesai) return;
        selesai = true;
        bersih();
        reject(new Error('Waktu habis. Server tidak menjawab.'));
      }, timeoutMs || 20000);

      function bersih() {
        clearTimeout(jam);
        try { delete window[nama]; } catch (e) { window[nama] = undefined; }
        if (skrip.parentNode) skrip.parentNode.removeChild(skrip);
      }

      window[nama] = function (data) {
        if (selesai) return;
        selesai = true;
        bersih();
        resolve(data);
      };

      skrip.onerror = function () {
        if (selesai) return;
        selesai = true;
        bersih();
        reject(new Error('Gagal menghubungi server.'));
      };

      var q = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');

      skrip.src = EL + '?' + q + '&callback=' + nama;
      document.body.appendChild(skrip);
    });
  }

  // ---------- masuk ----------
  function masuk(pin) {
    // PIN dikirim ke Apps Script lewat POST (form), bukan JSONP,
    // supaya PIN tidak pernah muncul di URL.
    var body = 'action=pintuPost&pin=' + encodeURIComponent(pin);

    return fetch(EL, {
      method: 'POST',
      body: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'follow'
    })
    .then(function (r) { return r.text(); })
    .then(function (txt) {
      // Apps Script membalas lewat redirect googleusercontent; cari JSON di dalamnya.
      var m = txt.match(/\{[\s\S]*\}/);
      var d = null;
      if (m) { try { d = JSON.parse(m[0]); } catch (e) { d = null; } }
      if (d && d.ok && d.t) return d.t;
      throw new Error((d && d.pesan) ? d.pesan : 'PIN salah. Coba lagi.');
    });
  }

  // ---------- gambar grafik ----------
  function gambarGrafik(tren) {
    var area = $('grafikArea');
    if (!tren || !tren.length) { area.innerHTML = '<div class="loading">Belum ada data.</div>'; return; }

    var W = 720, H = 220, PAD = 34;
    var maks = 0;
    tren.forEach(function (d) { maks = Math.max(maks, d.masuk, d.keluar); });
    if (maks <= 0) maks = 1;

    var kx = function (i) { return PAD + (i / Math.max(tren.length - 1, 1)) * (W - PAD * 2); };
    var ky = function (v) { return H - PAD - (v / maks) * (H - PAD * 2); };

    function garis(key) {
      return tren.map(function (d, i) {
        return kx(i).toFixed(1) + ',' + ky(d[key]).toFixed(1);
      }).join(' ');
    }

    var areaMasuk = 'M' + kx(0).toFixed(1) + ',' + (H - PAD) + ' L' +
      tren.map(function (d, i) { return kx(i).toFixed(1) + ',' + ky(d.masuk).toFixed(1); }).join(' L') +
      ' L' + kx(tren.length - 1).toFixed(1) + ',' + (H - PAD) + ' Z';

    // garis bantu horizontal
    var bantu = '';
    for (var g = 1; g <= 3; g++) {
      var gy = (PAD + (g / 4) * (H - PAD * 2)).toFixed(1);
      bantu += '<line x1="' + PAD + '" y1="' + gy + '" x2="' + (W - PAD) + '" y2="' + gy +
               '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';
    }

    // label tanggal (setiap 5 hari)
    var label = '';
    tren.forEach(function (d, i) {
      if (i % 5 !== 0 && i !== tren.length - 1) return;
      var x = kx(i).toFixed(1);
      label += '<text x="' + x + '" y="' + (H - 10) + '" fill="#7c7c8a" font-size="10" ' +
               'font-family="Nunito,sans-serif" text-anchor="middle">' +
               d.tgl.slice(8) + '</text>';
    });

    area.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" class="svg-grafik">' +
        '<defs><linearGradient id="gMasuk" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#4ade80" stop-opacity="0.28"/>' +
          '<stop offset="100%" stop-color="#4ade80" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        bantu +
        '<path d="' + areaMasuk + '" fill="url(#gMasuk)"/>' +
        '<polyline points="' + garis('masuk') + '" fill="none" stroke="#4ade80" ' +
          'stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
        '<polyline points="' + garis('keluar') + '" fill="none" stroke="#f87171" ' +
          'stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
        label +
      '</svg>';
  }

  function gambarBatang(tujuh) {
    var area = $('batangArea');
    if (!tujuh || !tujuh.length) { area.innerHTML = '<div class="loading">Belum ada data.</div>'; return; }

    var maks = 0;
    tujuh.forEach(function (d) { maks = Math.max(maks, d.masuk, d.keluar); });
    if (maks <= 0) maks = 1;

    var hari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    area.innerHTML = tujuh.map(function (d) {
      var dt = new Date(d.tgl + 'T00:00:00');
      var nm = hari[dt.getDay()];
      var hm = Math.max((d.masuk / maks) * 100, d.masuk > 0 ? 4 : 0);
      var hk = Math.max((d.keluar / maks) * 100, d.keluar > 0 ? 4 : 0);
      return '<div class="batang-hari" title="' + d.tgl + '">' +
        '<div class="batang-dua">' +
          '<span class="batang b-masuk" style="height:' + hm + '%"></span>' +
          '<span class="batang b-keluar" style="height:' + hk + '%"></span>' +
        '</div>' +
        '<div class="batang-nm">' + nm + '</div>' +
      '</div>';
    }).join('');
  }

  // ---------- render ----------
  function render(d) {
    if (!d) { tampilGalat('Data kosong.'); return; }

    $('nilaiAset').textContent = rp(d.totalAset);
    $('asetWaktu').textContent = d.waktu || '';
    $('navWaktu').textContent = d.waktu || '';

    var nRek = (d.rekening || []).length;
    $('jumlahRekening').textContent = nRek + ' rekening aktif';
    $('jumlahTransaksi').textContent = (d.totalTransaksi || 0) + ' transaksi';
    $('footJumlah').textContent = (d.totalTransaksi || 0) + ' transaksi tercatat';

    $('hariMasuk').textContent = rp(d.hari.masuk);
    $('hariKeluar').textContent = rp(d.hari.keluar);
    $('mingguMasuk').textContent = rp(d.minggu.masuk);
    $('mingguKeluar').textContent = rp(d.minggu.keluar);
    $('bulanMasuk').textContent = rp(d.bulan.masuk);
    $('bulanKeluar').textContent = rp(d.bulan.keluar);

    gambarGrafik(d.tren30);
    gambarBatang(d.tren7);

    // rekening
    var rek = d.rekening || [];
    $('rekeningList').innerHTML = rek.length
      ? rek.map(function (r) {
          return '<div class="rek">' +
            '<span class="rek-nm">' + esc(r.nama) + '</span>' +
            '<span class="rek-nilai">' + rp(r.saldo) + '</span>' +
          '</div>';
        }).join('')
      : '<div class="loading">Belum ada rekening.</div>';

    // kategori
    var kat = d.kategori || [];
    var katMax = kat.length ? kat[0].nilai : 1;
    $('kategoriList').innerHTML = kat.length
      ? kat.map(function (k) {
          var pct = Math.round((k.nilai / katMax) * 100);
          return '<div class="kat">' +
            '<div class="kat-atas">' +
              '<span class="kat-nm">' + esc(k.nama) + '</span>' +
              '<span class="kat-nilai">' + rp(k.nilai) + '</span>' +
            '</div>' +
            '<div class="kat-bar"><span style="width:' + pct + '%"></span></div>' +
          '</div>';
        }).join('')
      : '<div class="loading">Belum ada pengeluaran bulan ini.</div>';

    // transaksi
    var tx = d.terbaru || [];
    $('transaksiList').innerHTML = tx.length
      ? tx.map(function (t) {
          var kelas = t.transfer ? 'tf' : (t.tipe === 'MASUK' ? 'masuk' : 'keluar');
          var ttd = t.transfer ? '' : (t.tipe === 'MASUK' ? '+' : '−');
          return '<div class="tx ' + kelas + '">' +
            '<div class="tx-kiri">' +
              '<div class="tx-ket">' + esc(t.keterangan || t.kategori) + '</div>' +
              '<div class="tx-meta">' + esc(t.tgl.slice(8) + '/' + t.tgl.slice(5, 7)) +
                ' · ' + esc(t.kategori) + ' · ' + esc(t.sumber) + '</div>' +
            '</div>' +
            '<div class="tx-nilai">' + ttd + rp(t.nominal) + '</div>' +
          '</div>';
        }).join('')
      : '<div class="loading">Belum ada transaksi.</div>';

    tampilIsi();
  }

  // ---------- muat data ----------
  var sedangMuat = false;
  function muatData() {
    if (sedangMuat) return;
    sedangMuat = true;

    var t = ambilToken();
    if (!t) {
      sedangMuat = false;
      tampilGerbang('');
      return;
    }

    var tombol = [$('btnSegarkan'), $('btnSegarkan2')];
    tombol.forEach(function (b) { if (b) { b.disabled = true; b.style.opacity = '.5'; } });

    jsonp({ action: 'api', t: t })
      .then(function (res) {
        if (!res || !res.ok) {
          var pesan = (res && res.error) ? res.error : 'tidak sah';
          if (/token|sah|kedaluwarsa/i.test(pesan)) {
            hapusToken();
            tampilGerbang('Sesi berakhir. Masukkan PIN lagi.');
          } else {
            tampilGalat('Server menolak permintaan: ' + pesan);
          }
          return;
        }
        render(res.data);
      })
      .catch(function (err) {
        tampilGalat(err.message || 'Gagal memuat data.');
      })
      .then(function () {
        sedangMuat = false;
        tombol.forEach(function (b) { if (b) { b.disabled = false; b.style.opacity = ''; } });
      });
  }

  // ---------- event ----------
  $('formPin').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var pin = $('pinInput').value.trim();
    if (!pin) return;

    var bt = $('pinTombol');
    var salah = $('gerbangSalah');
    salah.className = 'gerbang-salah';
    bt.disabled = true;
    bt.textContent = 'Memeriksa…';

    masuk(pin).then(function (t) {
      simpanToken(t);
      bt.disabled = false;
      bt.textContent = 'Masuk';
      muatData();
    }).catch(function (err) {
      salah.textContent = err.message || 'PIN salah. Coba lagi.';
      salah.className = 'gerbang-salah tampil';
      $('pinInput').value = '';
      $('pinInput').focus();
      bt.disabled = false;
      bt.textContent = 'Masuk';
    });
  });

  $('btnSegarkan').addEventListener('click', muatData);
  $('btnSegarkan2').addEventListener('click', muatData);
  $('galatUlang').addEventListener('click', function () {
    $('galat').hidden = true;
    muatData();
  });

  // ---------- mulai ----------
  if (!EL) {
    tampilGalat('URL Apps Script belum diisi. Set environment variable APPS_SCRIPT_URL di Vercel.');
  } else if (ambilToken()) {
    muatData();
  } else {
    tampilGerbang('');
  }
})();
