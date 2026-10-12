/* Bale Ruang NTB — menu Regulasi.
   Katalog dokumen RTRW/RDTR yang dirujuk layer. Berkas kecil disimpan di folder regulasi/ aplikasi ini;
   berkas besar (RDTR hasil pindai) disimpan di situs dokumen terpisah (REG_EXT_BASE) agar ukuran aplikasi tetap ringan. */
(function () {
  'use strict';
  var REG_LOCAL_BASE = 'regulasi/';
  var REG_EXT_BASE = 'https://atrbpnproject.github.io/regulasi/';
  var REG_EXT_READY = true; // berkas besar sudah tersedia di situs dokumen
  var KATALOG = /*KATALOG*/[{"id":"rtrw-provinsi-ntb","wilayah":"Provinsi NTB","pulau":"Provinsi","jenis":"RTRW","nomor":"Peraturan Daerah Provinsi NTB Nomor 5 Tahun 2024","tentang":"Rencana Tata Ruang Wilayah Provinsi Nusa Tenggara Barat Tahun 2024–2044","files":[],"match":["Perda Provinsi NTB No. 5 Tahun 2024"],"catatan":"","status":"Dokumen sedang dihimpun"},{"id":"rtrw-mataram-2019","wilayah":"Kota Mataram","pulau":"Pulau Lombok","jenis":"RTRW","nomor":"Peraturan Daerah Kota Mataram Nomor 5 Tahun 2019","tentang":"Perubahan atas Perda Nomor 12 Tahun 2011 tentang RTRW Kota Mataram Tahun 2011–2031","files":[{"label":"Dokumen lengkap","file":"rtrw-mataram-2019.pdf","mb":0.8,"hal":134,"ext":false}],"match":["Perda Kota Mataram No. 5 Tahun 2019"],"catatan":"","status":""},{"id":"rdtr-mataram-2024","wilayah":"Kota Mataram","pulau":"Pulau Lombok","jenis":"RDTR","nomor":"Peraturan Wali Kota Mataram Nomor 19 Tahun 2024","tentang":"RDTR Kecamatan Ampenan, Sekarbela, Mataram, dan Selaparang","files":[{"label":"Dokumen lengkap","file":"rdtr-mataram-2024.pdf","mb":11.9,"hal":276,"ext":true}],"match":["Perwali Kota Mataram No. 19 Tahun 2024"],"catatan":"","status":""},{"id":"rtrw-lombok-barat-2011","wilayah":"Lombok Barat","pulau":"Pulau Lombok","jenis":"RTRW","nomor":"Peraturan Daerah Kabupaten Lombok Barat Nomor 11 Tahun 2011","tentang":"RTRW Kabupaten Lombok Barat Tahun 2011–2031","files":[{"label":"Dokumen lengkap","file":"rtrw-lombok-barat-2011.pdf","mb":1.7,"hal":129,"ext":false}],"match":["Perda Kabupaten Lombok Barat No. 11 Tahun 2011"],"catatan":"Naskah yang tersedia masih berjudul “Rancangan”.","status":""},{"id":"rdtr-geopark-2023","wilayah":"Lombok Barat","pulau":"Pulau Lombok","jenis":"RDTR","nomor":"Peraturan Bupati Lombok Barat Nomor 13 Tahun 2023","tentang":"RDTR Kawasan Geopark Rinjani-Lombok Narmada Lingsar Tahun 2023–2043","files":[{"label":"Dokumen lengkap","file":"rdtr-geopark-2023.pdf","mb":37.6,"hal":266,"ext":true}],"match":["Perbup Lombok Barat No. 13 Tahun 2023"],"catatan":"","status":""},{"id":"rdtr-senggigi-2023","wilayah":"Lombok Barat","pulau":"Pulau Lombok","jenis":"RDTR","nomor":"Peraturan Bupati Lombok Barat Nomor 14 Tahun 2023","tentang":"RDTR Kawasan Pariwisata Senggigi-Batulayar Tahun 2023–2043","files":[{"label":"Dokumen lengkap","file":"rdtr-senggigi-2023.pdf","mb":47.2,"hal":266,"ext":true}],"match":["Perbup Lombok Barat No. 14 Tahun 2023"],"catatan":"","status":""},{"id":"rdtr-sekotong-2023","wilayah":"Lombok Barat","pulau":"Pulau Lombok","jenis":"RDTR","nomor":"Peraturan Bupati Lombok Barat Nomor 30 Tahun 2023","tentang":"RDTR Kawasan Utara Sekotong Tahun 2023–2043","files":[{"label":"Dokumen lengkap","file":"rdtr-sekotong-2023.pdf","mb":34.1,"hal":235,"ext":true}],"match":["Perbup Lombok Barat No. 30 Tahun 2023"],"catatan":"","status":""},{"id":"rtrw-lombok-tengah-2011","wilayah":"Lombok Tengah","pulau":"Pulau Lombok","jenis":"RTRW","nomor":"Peraturan Daerah Kabupaten Lombok Tengah Nomor 7 Tahun 2011","tentang":"RTRW Kabupaten Lombok Tengah Tahun 2011–2031","files":[{"label":"Dokumen lengkap","file":"rtrw-lombok-tengah-2011.pdf","mb":1.3,"hal":61,"ext":false}],"match":["Perda Kabupaten Lombok Tengah No. 7 Tahun 2011"],"catatan":"","status":""},{"id":"rdtr-mandalika-2021","wilayah":"Lombok Tengah","pulau":"Pulau Lombok","jenis":"RDTR","nomor":"Peraturan Bupati Lombok Tengah Nomor 105 Tahun 2021","tentang":"RDTR Sekitar Kawasan Ekonomi Khusus Mandalika Tahun 2021–2041","files":[{"label":"Dokumen lengkap","file":"rdtr-mandalika-2021.pdf","mb":48.7,"hal":148,"ext":true}],"match":["Perbup Lombok Tengah No. 105 Tahun 2021"],"catatan":"","status":""},{"id":"rdtr-selong-belanak-2023","wilayah":"Lombok Tengah","pulau":"Pulau Lombok","jenis":"RDTR","nomor":"Peraturan Bupati Lombok Tengah Nomor 23 Tahun 2023","tentang":"RDTR Kawasan Selong Belanak Tahun 2023–2043","files":[{"label":"Dokumen lengkap","file":"rdtr-selong-belanak-2023.pdf","mb":4.9,"hal":42,"ext":false}],"match":["Perbup Lombok Tengah No. 23 Tahun 2023"],"catatan":"","status":""},{"id":"rtrw-lombok-timur-2012","wilayah":"Lombok Timur","pulau":"Pulau Lombok","jenis":"RTRW","nomor":"Peraturan Daerah Kabupaten Lombok Timur Nomor 2 Tahun 2012","tentang":"RTRW Kabupaten Lombok Timur Tahun 2012–2032","files":[{"label":"Dokumen lengkap","file":"rtrw-lombok-timur-2012.pdf","mb":0.5,"hal":70,"ext":false}],"match":["Perda Kab. Lombok Timur No. 2 Tahun 2012"],"catatan":"","status":""},{"id":"rdtr-pringgabaya-2023","wilayah":"Lombok Timur","pulau":"Pulau Lombok","jenis":"RDTR","nomor":"Peraturan Bupati Lombok Timur Nomor 16 Tahun 2023","tentang":"RDTR Wilayah Perencanaan Perkotaan Pringgabaya","files":[{"label":"Batang tubuh","file":"rdtr-pringgabaya-2023.pdf","mb":0.7,"hal":42,"ext":false},{"label":"Lampiran","file":"rdtr-pringgabaya-2023-lampiran.pdf","mb":9.4,"hal":130,"ext":true}],"match":["Perbup Lombok Timur No. 16 Tahun 2023"],"catatan":"","status":""},{"id":"rdtr-sambelia-2024","wilayah":"Lombok Timur","pulau":"Pulau Lombok","jenis":"RDTR","nomor":"Peraturan Bupati Lombok Timur Nomor 11 Tahun 2024","tentang":"RDTR Wilayah Perencanaan Sambelia dan Sekitarnya Tahun 2024–2043","files":[{"label":"Dokumen lengkap","file":"rdtr-sambelia-2024.pdf","mb":7.7,"hal":220,"ext":true}],"match":["Perbup Lombok Timur No. 11 Tahun 2024"],"catatan":"","status":""},{"id":"rtrw-lombok-utara-2011","wilayah":"Lombok Utara","pulau":"Pulau Lombok","jenis":"RTRW","nomor":"Peraturan Daerah Kabupaten Lombok Utara Nomor 9 Tahun 2011","tentang":"RTRW Kabupaten Lombok Utara Tahun 2011–2031","files":[{"label":"Dokumen lengkap","file":"rtrw-lombok-utara-2011.pdf","mb":0.4,"hal":58,"ext":false}],"match":["Perda Kabupaten Lombok Utara No. 9 Tahun 2011"],"catatan":"","status":""},{"id":"rdtr-tanjung-2020","wilayah":"Lombok Utara","pulau":"Pulau Lombok","jenis":"RDTR","nomor":"Peraturan Bupati Lombok Utara Nomor 20 Tahun 2020","tentang":"RDTR Kawasan Perkotaan Tanjung Tahun 2020–2040","files":[{"label":"Dokumen lengkap","file":"rdtr-tanjung-2020.pdf","mb":20.7,"hal":201,"ext":true}],"match":["Perbup Lombok Utara No. 20 Tahun 2020"],"catatan":"","status":""},{"id":"rtrw-sumbawa-barat-2020","wilayah":"Sumbawa Barat","pulau":"Pulau Sumbawa","jenis":"RTRW","nomor":"Peraturan Daerah Kabupaten Sumbawa Barat Nomor 11 Tahun 2020","tentang":"RTRW Kabupaten Sumbawa Barat Tahun 2020–2040","files":[{"label":"Dokumen lengkap","file":"rtrw-sumbawa-barat-2020.pdf","mb":0.7,"hal":92,"ext":false}],"match":["Perda Kab. Sumbawa Barat No. 11 Tahun 2020"],"catatan":"","status":""},{"id":"rdtr-taliwang-2016","wilayah":"Sumbawa Barat","pulau":"Pulau Sumbawa","jenis":"RDTR","nomor":"Peraturan Daerah Kabupaten Sumbawa Barat Nomor 12 Tahun 2016","tentang":"RDTR dan Peraturan Zonasi Kawasan Perkotaan Taliwang Tahun 2015–2035","files":[{"label":"Dokumen lengkap","file":"rdtr-taliwang-2016.pdf","mb":0.8,"hal":91,"ext":false}],"match":["Perda Sumbawa Barat No. 12 Tahun 2016"],"catatan":"","status":""},{"id":"rdtr-maluk-2023","wilayah":"Sumbawa Barat","pulau":"Pulau Sumbawa","jenis":"RDTR","nomor":"Peraturan Bupati Sumbawa Barat Nomor 4 Tahun 2023","tentang":"RDTR Sekitar Kawasan Industri Maluk","files":[{"label":"Dokumen lengkap","file":"rdtr-maluk-2023.pdf","mb":7.0,"hal":120,"ext":true}],"match":["Perbup Sumbawa Barat No. 4 Tahun 2023"],"catatan":"","status":""},{"id":"rtrw-sumbawa-2012","wilayah":"Sumbawa","pulau":"Pulau Sumbawa","jenis":"RTRW","nomor":"Peraturan Daerah Kabupaten Sumbawa Nomor 10 Tahun 2012","tentang":"RTRW Kabupaten Sumbawa Tahun 2011–2031","files":[{"label":"Batang tubuh","file":"rtrw-sumbawa-2012.pdf","mb":0.4,"hal":75,"ext":false}],"match":["Perda Kabupaten Sumbawa No. 10 Tahun 2012"],"catatan":"","status":""},{"id":"rdtr-sumbawa-besar-2023","wilayah":"Sumbawa","pulau":"Pulau Sumbawa","jenis":"RDTR","nomor":"Peraturan Bupati Sumbawa Nomor 5 Tahun 2023","tentang":"RDTR Kawasan Perkotaan Sumbawa Besar","files":[{"label":"Dokumen lengkap","file":"rdtr-sumbawa-besar-2023.pdf","mb":17.6,"hal":139,"ext":true}],"match":["Perbup Sumbawa No. 5 Tahun 2023"],"catatan":"","status":""},{"id":"rtrw-dompu","wilayah":"Dompu","pulau":"Pulau Sumbawa","jenis":"RTRW","nomor":"Peraturan Daerah Kabupaten Dompu Nomor 2 Tahun 2012","tentang":"RTRW Kabupaten Dompu Tahun 2011–2031","files":[],"match":["Perda Kab. Dompu No. 2 Tahun 2012"],"catatan":"","status":"Salinan resmi sedang dihimpun"},{"id":"rtrw-bima-2011","wilayah":"Kabupaten Bima","pulau":"Pulau Sumbawa","jenis":"RTRW","nomor":"Peraturan Daerah Kabupaten Bima Nomor 9 Tahun 2011","tentang":"RTRW Kabupaten Bima Tahun 2011–2031","files":[{"label":"Dokumen lengkap","file":"rtrw-bima-2011.pdf","mb":3.7,"hal":126,"ext":false}],"match":["Perda Kabupaten Bima No. 9 Tahun 2011"],"catatan":"","status":""},{"id":"rdtr-woha-2019","wilayah":"Kabupaten Bima","pulau":"Pulau Sumbawa","jenis":"RDTR","nomor":"Peraturan Daerah Kabupaten Bima Nomor 1 Tahun 2019","tentang":"RDTR dan Peraturan Zonasi Kawasan Perkotaan Woha Tahun 2019–2039","files":[{"label":"Batang tubuh","file":"rdtr-woha-2019.pdf","mb":0.8,"hal":81,"ext":false},{"label":"Lampiran ITBX & peta","file":"rdtr-woha-2019-lampiran.pdf","mb":32.6,"hal":43,"ext":true}],"match":["Perda Kabupaten Bima No. 1 Tahun 2019"],"catatan":"","status":""},{"id":"rdtr-sape-2023","wilayah":"Kabupaten Bima","pulau":"Pulau Sumbawa","jenis":"RDTR","nomor":"Peraturan Bupati Bima Nomor 31 Tahun 2023","tentang":"RDTR Kawasan Perkotaan Sape","files":[{"label":"Dokumen lengkap","file":"rdtr-sape-2023.pdf","mb":19.6,"hal":133,"ext":true}],"match":["Perbup Bima No. 31 Tahun 2023"],"catatan":"","status":""},{"id":"rdtr-monta-2021","wilayah":"Kabupaten Bima","pulau":"Pulau Sumbawa","jenis":"RDTR","nomor":"Peraturan Bupati Bima Nomor 42 Tahun 2021","tentang":"RDTR Wilayah Perencanaan Kecamatan Monta Tahun 2021–2041","files":[{"label":"Dokumen lengkap","file":"rdtr-monta-2021.pdf","mb":24.1,"hal":257,"ext":true}],"match":["Perbup Bima No. 42 Tahun 2021"],"catatan":"","status":""},{"id":"rtrw-kota-bima-2024","wilayah":"Kota Bima","pulau":"Pulau Sumbawa","jenis":"RTRW","nomor":"Peraturan Daerah Kota Bima Nomor 4 Tahun 2024","tentang":"RTRW Kota Bima Tahun 2024–2044","files":[{"label":"Dokumen lengkap","file":"rtrw-kota-bima-2024.pdf","mb":1.1,"hal":172,"ext":false}],"match":["Perda Kota Bima No. 4 Tahun 2024"],"catatan":"","status":""}]/*END*/;

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(v) { return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function fileUrl(f) { return (f.ext ? REG_EXT_BASE : REG_LOCAL_BASE) + f.file; }
  function fileReady(f) { return !f.ext || REG_EXT_READY; }
  function entryReady(e) { return e.files.length && e.files.some(fileReady); }
  function mb(v) { return (v < 1 ? v.toFixed(1) : Math.round(v)).toString().replace('.', ',') + ' MB'; }

  var byLegal = Object.create(null);
  KATALOG.forEach(function (e) { e.match.forEach(function (m) { byLegal[norm(m)] = e; }); });

  function findByLegal(legal) { return byLegal[norm(legal)] || null; }
  window.brRegulasiFor = findByLegal;
  // Tombol kecil untuk Rincian hasil analisis (hanya bila dokumennya sudah dapat dibuka).
  window.brRegulasiLink = function (legal) {
    var e = findByLegal(legal);
    if (!e || !entryReady(e)) return '';
    return '<button type="button" class="reg-link" data-reg-open="' + esc(e.id) + '"><i class="fas fa-balance-scale"></i>Lihat regulasi</button>';
  };

  var state = { q: '', jenis: 'Semua', focus: '' };
  function itemHtml(e) {
    var files = e.files.map(function (f) {
      var meta = f.hal + ' hlm · ' + mb(f.mb);
      if (!fileReady(f)) return '<span class="reg-file off"><i class="fas fa-clock"></i><b>' + esc(f.label) + '</b><small>Segera tersedia · ' + meta + '</small></span>';
      return '<a class="reg-file" href="' + esc(fileUrl(f)) + '" target="_blank" rel="noopener"><i class="fas fa-file-pdf"></i><b>' + esc(f.label) + '</b><small>' + meta + '</small></a>';
    }).join('');
    if (!e.files.length) files = '<span class="reg-file off"><i class="fas fa-hourglass-half"></i><b>' + esc(e.status || 'Dokumen belum tersedia') + '</b></span>';
    return '<article class="reg-item' + (state.focus === e.id ? ' focus' : '') + '" id="reg-' + esc(e.id) + '">'
      + '<div class="reg-head"><span class="reg-badge ' + e.jenis.toLowerCase() + '">' + esc(e.jenis) + '</span><b>' + esc(e.nomor) + '</b></div>'
      + '<p class="reg-about">' + esc(e.tentang) + '</p>'
      + (e.catatan ? '<p class="reg-note">' + esc(e.catatan) + '</p>' : '')
      + '<div class="reg-files">' + files + '</div></article>';
  }
  function render() {
    var body = document.getElementById('regList'); if (!body) return;
    var q = norm(state.q), groups = [], seen = Object.create(null), count = 0;
    KATALOG.forEach(function (e) {
      if (state.jenis !== 'Semua' && e.jenis !== state.jenis) return;
      if (q && norm([e.wilayah, e.pulau, e.jenis, e.nomor, e.tentang].join(' ')).indexOf(q) < 0) return;
      if (!seen[e.wilayah]) { seen[e.wilayah] = { name: e.wilayah, pulau: e.pulau, items: [] }; groups.push(seen[e.wilayah]); }
      seen[e.wilayah].items.push(e); count++;
    });
    var html = '', lastPulau = '';
    groups.forEach(function (g) {
      if (g.pulau !== lastPulau) { html += '<h3 class="reg-pulau">' + esc(g.pulau) + '</h3>'; lastPulau = g.pulau; }
      html += '<section class="reg-group"><h4>' + esc(g.name) + '</h4>' + g.items.map(itemHtml).join('') + '</section>';
    });
    body.innerHTML = html || '<p class="reg-empty">Tidak ada regulasi yang cocok dengan pencarian.</p>';
    var c = document.getElementById('regCount'); if (c) c.textContent = count + ' regulasi';
  }

  function build() {
    if (document.getElementById('regulasiModal')) return;
    var shell = document.createElement('div');
    shell.className = 'modal-shell'; shell.id = 'regulasiModal';
    shell.innerHTML = '<section class="modal reg-modal"><div class="modal-top"><h2>Regulasi Tata Ruang</h2><button type="button" class="close" data-close>&times;</button></div>'
      + '<div class="modal-body">'
      + '<p class="reg-lead">Dokumen RTRW dan RDTR yang menjadi dasar layer di Bale Ruang NTB. Ketuk dokumen untuk membuka PDF-nya.</p>'
      + '<div class="reg-tools"><label class="reg-search"><i class="fas fa-search"></i><input id="regSearch" type="search" placeholder="Cari wilayah, nomor, atau nama kawasan" autocomplete="off"></label>'
      + '<div class="reg-chips" role="tablist"><button type="button" class="on" data-jenis="Semua">Semua</button><button type="button" data-jenis="RTRW">RTRW</button><button type="button" data-jenis="RDTR">RDTR</button></div>'
      + '<span id="regCount" class="reg-count"></span></div>'
      + '<div id="regList"></div>'
      + '<p class="reg-foot">Dokumen dihimpun sebagai rujukan. Untuk keperluan resmi, gunakan salinan dari JDIH atau instansi penerbit. Bila menemukan dokumen yang keliru atau sudah dicabut, mohon sampaikan kepada tim pengembang.</p>'
      + '</div></section>';
    document.body.appendChild(shell);
    shell.addEventListener('click', function (ev) { if (ev.target === shell) shell.classList.remove('open'); });
    shell.querySelector('[data-close]').addEventListener('click', function () { shell.classList.remove('open'); });
    var input = shell.querySelector('#regSearch');
    input.addEventListener('input', function () { state.q = input.value; state.focus = ''; render(); });
    shell.querySelectorAll('[data-jenis]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.jenis = b.dataset.jenis; state.focus = '';
        shell.querySelectorAll('[data-jenis]').forEach(function (x) { x.classList.toggle('on', x === b); });
        render();
      });
    });
    render();
  }
  function open(id) {
    build();
    var shell = document.getElementById('regulasiModal');
    if (id) {
      state.q = ''; state.jenis = 'Semua'; state.focus = id;
      shell.querySelector('#regSearch').value = '';
      shell.querySelectorAll('[data-jenis]').forEach(function (x) { x.classList.toggle('on', x.dataset.jenis === 'Semua'); });
    }
    render();
    shell.classList.add('open');
    if (id) setTimeout(function () { var el = document.getElementById('reg-' + id); if (el) el.scrollIntoView({ block: 'center' }); }, 60);
  }
  window.brOpenRegulasi = open;

  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('[data-reg-open],[data-open-regulasi]');
    if (!t) return;
    ev.preventDefault(); ev.stopPropagation();
    open(t.getAttribute('data-reg-open') || '');
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
