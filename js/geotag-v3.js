/* Bale Ruang NTB — Foto & PDF Geotag (v3)
   Kamera layar penuh dengan akurasi GPS langsung, arah kompas, cap koordinat pada foto,
   hingga 4 foto per laporan, foto dari galeri (data GPS EXIF), dan laporan PDF A4 yang rapi. */
(function () {
  'use strict';
  var MAX_PHOTOS = 4, GOOD = 10, FAIR = 30;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) { return ''; } }

  // ---------- Koordinat ----------
  // TM-3 DGN95 (k0 0,9999, FE 200.000, FN 1.500.000). Pulau Sumbawa = zona 50.2, selain itu 50.1.
  function tm3(lon, lat, regency) {
    var name = String(regency || '').trim().toLowerCase().replace(/^(kabupaten|kab\.)\s*/, ''),
      east = ['sumbawa barat', 'sumbawa', 'dompu', 'bima', 'kota bima'].indexOf(name) >= 0 || lon >= 117,
      zone = east ? '50.2' : '50.1', cm = east ? 118.5 : 115.5, a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f), ep2 = e2 / (1 - e2), k0 = .9999,
      phi = lat * Math.PI / 180, lam = (lon - cm) * Math.PI / 180, sin = Math.sin(phi), cos = Math.cos(phi), tan = Math.tan(phi),
      n = a / Math.sqrt(1 - e2 * sin * sin), t = tan * tan, c = ep2 * cos * cos, A = cos * lam, e4 = e2 * e2, e6 = e4 * e2,
      m = a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi) - (35 * e6 / 3072) * Math.sin(6 * phi));
    return { zone: zone,
      x: Math.round(200000 + k0 * n * (A + (1 - t + c) * Math.pow(A, 3) / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * Math.pow(A, 5) / 120)),
      y: Math.round(1500000 + k0 * (m + n * tan * (A * A / 2 + (5 - t + 9 * c + 4 * c * c) * Math.pow(A, 4) / 24 + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * Math.pow(A, 6) / 720))) };
  }
  function dms(v, pos, neg) { var h = v < 0 ? neg : pos, a = Math.abs(v), d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), s = (mf - m) * 60; return d + '°' + pad(m) + "'" + s.toFixed(2).replace('.', ',') + '"' + h; }
  function idNum(n) { return Number(n).toLocaleString('id-ID'); }
  var DIRS = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  function dirName(h) { return DIRS[Math.round(((h % 360) + 360) % 360 / 45) % 8]; }
  function accClass(acc) { return acc == null ? 'none' : acc <= GOOD ? 'good' : acc <= FAIR ? 'fair' : 'poor'; }
  function accText(acc) { return acc == null ? 'GPS tidak tersedia' : '± ' + Math.max(1, Math.round(acc)) + ' m'; }

  // ---------- Administrasi (data batas desa NTB, cadangan alamat internet) ----------
  function inRing(pt, ring) { var x = pt[0], y = pt[1], hit = false; for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) { var a = ring[i], b = ring[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit; } return hit; }
  function contains(g, lon, lat) { var ps = g && g.type === 'Polygon' ? [g.coordinates] : g && g.type === 'MultiPolygon' ? g.coordinates : []; for (var p = 0; p < ps.length; p++) { var r = ps[p] || []; if (!r.length || !inRing([lon, lat], r[0])) continue; var hole = false; for (var h = 1; h < r.length; h++) if (inRing([lon, lat], r[h])) { hole = true; break; } if (!hole) return true; } return false; }
  function adminAt(lon, lat) {
    var local = typeof window.ntbAdminLookup === 'function'
      ? window.ntbAdminLookup(lon, lat, contains).then(function (fs) { var a = fs && fs[0] && fs[0].properties; return a ? { village: a.WADMKD || a.DESA || a.NAMOBJ || '', district: a.WADMKC || a.KECAMATAN || '', regency: a.WADMKK || a.KAB_KOTA || '', province: a.WADMPR || 'Nusa Tenggara Barat', source: 'Batas Desa/Kelurahan NTB' } : null; }).catch(function () { return null; })
      : Promise.resolve(null);
    return local.then(function (r) {
      if (r && r.village) return r;
      var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=16&lat=' + lat + '&lon=' + lon;
      return Promise.race([fetch(url, { headers: { 'Accept-Language': 'id' } }).then(function (x) { return x.json(); }), new Promise(function (_, rej) { setTimeout(rej, 7000); })])
        .then(function (d) { var a = d.address || {}; return { village: a.village || a.hamlet || a.suburb || a.neighbourhood || '', district: a.city_district || a.district || a.subdistrict || a.town || '', regency: a.county || a.city || '', province: a.state || '', source: 'OpenStreetMap' }; })
        .catch(function () { return { village: '', district: '', regency: '', province: '', source: '' }; });
    });
  }
  function placeLine(ad) { return [ad.village && 'Desa/Kel. ' + ad.village, ad.district && 'Kec. ' + ad.district, ad.regency].filter(Boolean).join(', '); }

  // ---------- GPS: pantau terus, ambil pembacaan terbaik ----------
  var gps = { id: null, samples: [], last: null, err: null, subs: [] };
  function gpsStart() {
    if (gps.id != null || !navigator.geolocation) return;
    gps.err = null;
    gps.id = navigator.geolocation.watchPosition(function (p) {
      var s = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy || null, t: Date.now() };
      gps.last = s; gps.samples.push(s); if (gps.samples.length > 40) gps.samples.shift(); gps.err = null;
      gps.subs.forEach(function (f) { f(); });
    }, function (e) { gps.err = e; gps.subs.forEach(function (f) { f(); }); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  }
  function gpsStop() { if (gps.id != null) navigator.geolocation.clearWatch(gps.id); gps.id = null; gps.samples = []; gps.last = null; }
  // Pembacaan terbaik dari beberapa detik terakhir saja, agar posisi lama (sebelum pindah tempat) tidak terpakai.
  function gpsBest(windowMs) {
    var now = Date.now(), win = Math.min(windowMs, 4000), best = null;
    gps.samples.forEach(function (s) { if (now - s.t <= win && (!best || (s.acc || 1e9) < (best.acc || 1e9))) best = s; });
    if (!best && gps.last && now - gps.last.t <= windowMs) best = gps.last;
    return best;
  }
  function gpsError(e) {
    if (!window.isSecureContext) return 'GPS hanya bisa dipakai melalui alamat https:// resmi Bale Ruang NTB.';
    if (e && e.code === 1) return 'Izin lokasi ditolak. Buka pengaturan situs, izinkan Lokasi, lalu coba lagi.';
    if (e && e.code === 2) return 'Sinyal GPS belum tersedia. Aktifkan GPS dan pindah ke area terbuka.';
    if (e && e.code === 3) return 'GPS terlalu lama merespons. Pastikan GPS aktif.';
    return 'Lokasi perangkat belum dapat dibaca.';
  }

  // ---------- Kompas ----------
  var compass = { h: null, on: false };
  function compassStart() {
    if (compass.on) return; compass.on = true;
    function onOri(e) {
      var h = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
      else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha;
      if (h == null) return;
      var so = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      compass.h = ((h + so) % 360 + 360) % 360;
    }
    var go = function () { window.addEventListener('deviceorientationabsolute', onOri, true); window.addEventListener('deviceorientation', onOri, true); };
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(function (s) { if (s === 'granted') go(); }).catch(function () {});
    else go();
  }

  // ---------- EXIF (foto dari galeri) ----------
  function readExif(buf) {
    try {
      var v = new DataView(buf); if (v.getUint16(0) !== 0xFFD8) return null;
      var off = 2;
      while (off < v.byteLength - 4) {
        var marker = v.getUint16(off), len = v.getUint16(off + 2);
        if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
        if ((marker & 0xFF00) !== 0xFF00) break; off += 2 + len;
      }
    } catch (e) {}
    return null;
  }
  function parseTiff(v, t) {
    var le = v.getUint16(t) === 0x4949, u16 = function (o) { return v.getUint16(o, le); }, u32 = function (o) { return v.getUint32(o, le); };
    function ifd(o) { var n = u16(o), out = {}; for (var i = 0; i < n; i++) { var e = o + 2 + i * 12; out[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 }; } return out; }
    function rat(o) { return u32(o) / (u32(o + 4) || 1); }
    function ascii(en) { var o = en.count > 4 ? t + u32(en.at) : en.at, s = ''; for (var i = 0; i < en.count - 1; i++) s += String.fromCharCode(v.getUint8(o + i)); return s; }
    var main = ifd(t + u32(t + 4)), res = {};
    if (main[0x8769]) { var ex = ifd(t + u32(main[0x8769].at)); if (ex[0x9003]) res.time = ascii(ex[0x9003]); }
    if (!res.time && main[0x0132]) res.time = ascii(main[0x0132]);
    if (main[0x8825]) {
      var g = ifd(t + u32(main[0x8825].at));
      if (g[2] && g[4]) {
        var la = t + u32(g[2].at), lo = t + u32(g[4].at);
        var lat = rat(la) + rat(la + 8) / 60 + rat(la + 16) / 3600, lon = rat(lo) + rat(lo + 8) / 60 + rat(lo + 16) / 3600;
        if (g[1] && String.fromCharCode(v.getUint8(g[1].at)) === 'S') lat = -lat;
        if (g[3] && String.fromCharCode(v.getUint8(g[3].at)) === 'W') lon = -lon;
        if (isFinite(lat) && isFinite(lon) && (lat || lon)) { res.lat = lat; res.lon = lon; }
        if (g[0x1F] && g[0x1F].type === 5) res.acc = rat(t + u32(g[0x1F].at));
        if (g[0x11] && g[0x11].type === 5) res.heading = rat(t + u32(g[0x11].at));
      }
    }
    return res;
  }
  function exifDate(s) { var m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(s || ''); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null; }

  // ---------- Foto + cap ----------
  function fitCanvas(src, w, h) {
    var max = 2400, s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  var logoImg = null;
  function logo() { if (!logoImg) { logoImg = new Image(); logoImg.src = 'images/bale-ruang-ntb-logo-v3.png'; } return logoImg; }
  function fmtDate(d) { return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function tzName(d) { var o = -d.getTimezoneOffset() / 60; return o === 7 ? 'WIB' : o === 8 ? 'WITA' : o === 9 ? 'WIT' : 'UTC' + (o >= 0 ? '+' : '') + o; }
  function stamp(p) {
    var src = p.raw, c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    var g = c.getContext('2d'); g.drawImage(src, 0, 0);
    var W = c.width, H = c.height, u = Math.max(13, Math.min(W, H) * 0.028), pad1 = u * 1.1;
    var m = tm3(p.lon, p.lat, p.admin && p.admin.regency), place = p.admin ? placeLine(p.admin) : '';
    var lines = [
      { t: fmtDate(p.time) + '  ' + fmtTime(p.time) + ' ' + tzName(p.time), b: true },
      { t: p.lat.toFixed(6) + ', ' + p.lon.toFixed(6) + (p.acc != null ? '   ± ' + Math.round(p.acc) + ' m' : '') },
      { t: 'TM-3 ' + m.zone + '  X ' + idNum(m.x) + '  Y ' + idNum(m.y) + (p.heading != null ? '   ·   ' + dirName(p.heading) + ' ' + Math.round(p.heading) + '°' : '') }
    ];
    if (place) lines.push({ t: place });
    var lh = u * 1.45, boxH = lines.length * lh + pad1 * 1.6;
    var grd = g.createLinearGradient(0, H - boxH - u * 2, 0, H);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.35, 'rgba(0,0,0,.45)'); grd.addColorStop(1, 'rgba(0,0,0,.7)');
    g.fillStyle = grd; g.fillRect(0, H - boxH - u * 2, W, boxH + u * 2);
    g.textBaseline = 'alphabetic'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = u * 0.25;
    var y = H - boxH + pad1 * 0.6 + u;
    lines.forEach(function (l) { g.font = (l.b ? '600 ' : '400 ') + Math.round(u) + 'px -apple-system,"Segoe UI",Roboto,Arial,sans-serif'; g.fillStyle = l.b ? '#fff' : 'rgba(255,255,255,.92)'; g.fillText(l.t, pad1, y, W - pad1 * 2 - u * 7); y += lh; });
    // merek di kanan bawah
    var L = logo(), ls = u * 2.2, bx = W - pad1 - ls;
    g.shadowBlur = 0;
    if (L.complete && L.naturalWidth) g.drawImage(L, bx, H - pad1 - ls - u * 1.15, ls, ls);
    g.font = '600 ' + Math.round(u * 0.72) + 'px -apple-system,"Segoe UI",Roboto,Arial,sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'right';
    g.fillText('Bale Ruang NTB', W - pad1, H - pad1 * 0.9); g.textAlign = 'left';
    p.stamped = c;
    return c;
  }

  // ---------- Antarmuka ----------
  var S = { photos: [], cur: 0, stream: null, el: null, view: '', busy: false };
  var ICON = { close: '<i class="fas fa-times"></i>', img: '<i class="fas fa-images"></i>', loc: '<i class="fas fa-location-arrow"></i>', cam: '<i class="fas fa-camera"></i>' };
  function build() {
    if (S.el) return S.el;
    logo();
    var el = document.createElement('div'); el.className = 'gt-shell'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML =
      '<section class="gt-cam">'
      + '<video class="gt-video" playsinline muted autoplay></video><div class="gt-camerr" hidden><i class="fas fa-video-slash"></i><b>Kamera tidak dapat dibuka</b><span class="gt-camerr-t"></span></div>'
      + '<div class="gt-top"><button type="button" class="gt-round gt-x" aria-label="Tutup">' + ICON.close + '</button>'
      + '<span class="gt-chip gt-gps none"><i></i><b>Mencari GPS…</b></span><span class="gt-chip gt-dir" hidden></span></div>'
      + '<div class="gt-hint"></div>'
      + '<div class="gt-bottom"><button type="button" class="gt-round gt-gal" aria-label="Pilih dari galeri">' + ICON.img + '</button>'
      + '<button type="button" class="gt-shutter" aria-label="Ambil foto"><span></span></button>'
      + '<button type="button" class="gt-thumb" aria-label="Lihat foto" hidden><img alt=""><em></em></button><span class="gt-thumb-ph"></span></div>'
      + '<div class="gt-lock" hidden><div class="gt-lock-card"><span class="gt-spin"></span><b>Mengunci lokasi…</b><small class="gt-lock-t"></small><button type="button" class="gt-link gt-lock-go">Gunakan posisi saat ini</button></div></div>'
      + '</section>'
      + '<section class="gt-rev">'
      + '<header class="gt-bar"><button type="button" class="gt-link gt-back">' + '<i class="fas fa-chevron-left"></i> Kamera</button><b>Pratinjau</b><button type="button" class="gt-link gt-done">Tutup</button></header>'
      + '<div class="gt-scroll"><figure class="gt-fig"><img class="gt-main" alt="Foto geotag"><button type="button" class="gt-del" aria-label="Hapus foto ini"><i class="fas fa-trash-alt"></i></button></figure>'
      + '<div class="gt-strip"></div>'
      + '<div class="gt-group gt-info"></div>'
      + '<div class="gt-group gt-form">'
      + '<label><span>Judul</span><input class="gt-in-title" maxlength="80" placeholder="mis. Bidang tanah Bpk. Ahmad"></label>'
      + '<label><span>Keterangan</span><textarea class="gt-in-note" rows="2" maxlength="400" placeholder="Opsional"></textarea></label>'
      + '<label><span>Petugas</span><input class="gt-in-off" maxlength="60" placeholder="Opsional"></label></div>'
      + '<p class="gt-foot">Koordinat dikunci saat foto diambil. Akurasi di bawah ± ' + GOOD + ' m sangat baik; di atas ± ' + FAIR + ' m sebaiknya ulangi di area terbuka.</p></div>'
      + '<footer class="gt-actions"><button type="button" class="gt-btn gt-save"><i class="fas fa-download"></i> Simpan foto</button><button type="button" class="gt-btn gt-primary gt-pdf"><i class="fas fa-file-pdf"></i> Buat PDF</button></footer>'
      + '</section><input type="file" class="gt-file" accept="image/jpeg,image/*" hidden>';
    document.body.appendChild(el); S.el = el;
    $('.gt-x', el).onclick = closeAll;
    $('.gt-done', el).onclick = closeAll;
    $('.gt-back', el).onclick = function () { showCam(); };
    $('.gt-shutter', el).onclick = shoot;
    $('.gt-gal', el).onclick = function () { $('.gt-file', el).click(); };
    $('.gt-file', el).onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (f) fromFile(f); };
    $('.gt-thumb', el).onclick = function () { showReview(S.photos.length - 1); };
    $('.gt-del', el).onclick = function () { removePhoto(S.cur); };
    $('.gt-save', el).onclick = savePhoto;
    $('.gt-pdf', el).onclick = makePdf;
    var off = $('.gt-in-off', el); off.value = store('br.geotag.officer'); off.oninput = function () { store('br.geotag.officer', off.value); };
    gps.subs.push(updateGpsChip);
    setInterval(function () { if (S.view === 'cam') updateDir(); }, 400);
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopCam(); else if (S.view === 'cam') startCam(); });
    return el;
  }
  function toast(t) { if (window.brToast) window.brToast(t, 4000); else alert(t); }
  function updateGpsChip() {
    if (!S.el) return;
    var chip = $('.gt-gps', S.el), hint = $('.gt-hint', S.el), s = gps.last;
    if (gps.err && !s) { chip.className = 'gt-chip gt-gps poor'; chip.querySelector('b').textContent = 'GPS tidak aktif'; hint.textContent = gpsError(gps.err); return; }
    if (!s) { chip.className = 'gt-chip gt-gps none'; chip.querySelector('b').textContent = 'Mencari GPS…'; hint.textContent = 'Tunggu sebentar, sinyal GPS sedang dicari'; return; }
    chip.className = 'gt-chip gt-gps ' + accClass(s.acc); chip.querySelector('b').textContent = accText(s.acc);
    hint.textContent = s.acc <= FAIR ? '' : 'Akurasi GPS masih lemah — pindah ke area terbuka bila memungkinkan';
  }
  function updateDir() {
    var d = $('.gt-dir', S.el);
    if (compass.h == null) { d.hidden = true; return; }
    d.hidden = false; d.innerHTML = '<i class="fas fa-location-arrow" style="transform:rotate(' + (compass.h - 45) + 'deg)"></i>' + dirName(compass.h) + ' ' + Math.round(compass.h) + '°';
  }
  function startCam() {
    if (S.stream || !S.el) return;
    var v = $('.gt-video', S.el), err = $('.gt-camerr', S.el);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { err.hidden = false; $('.gt-camerr-t', S.el).textContent = 'Browser ini tidak mendukung kamera. Gunakan tombol galeri untuk memilih foto.'; return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false }).then(function (st) {
      if (S.view !== 'cam') { st.getTracks().forEach(function (t) { t.stop(); }); return; }
      S.stream = st; v.srcObject = st; err.hidden = true; v.play().catch(function () {});
    }).catch(function (e) {
      err.hidden = false;
      $('.gt-camerr-t', S.el).textContent = e && e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan situs, atau pilih foto dari galeri.' : 'Kamera tidak ditemukan atau sedang dipakai aplikasi lain. Anda tetap bisa memilih foto dari galeri.';
    });
  }
  function stopCam() { if (S.stream) { S.stream.getTracks().forEach(function (t) { t.stop(); }); S.stream = null; } if (S.el) $('.gt-video', S.el).srcObject = null; }
  function showCam() {
    build(); S.view = 'cam';
    S.el.className = 'gt-shell open cam';
    gpsStart(); updateGpsChip(); startCam();
    var th = $('.gt-thumb', S.el), n = S.photos.length;
    th.hidden = !n; $('.gt-thumb-ph', S.el).hidden = !!n;
    if (n) { th.querySelector('img').src = S.photos[n - 1].thumb; th.querySelector('em').textContent = n; }
    $('.gt-shutter', S.el).disabled = n >= MAX_PHOTOS;
    if (n >= MAX_PHOTOS) $('.gt-hint', S.el).textContent = 'Maksimal ' + MAX_PHOTOS + ' foto per laporan';
  }
  function open() {
    build();
    S.photos = []; $('.gt-in-title', S.el).value = ''; $('.gt-in-note', S.el).value = '';
    compassStart();
    showCam();
  }
  function closeAll() { stopCam(); gpsStop(); S.view = ''; if (S.el) S.el.className = 'gt-shell'; }

  function addPhoto(p) {
    p.admin = null;
    stamp(p); p.thumb = thumbOf(p.stamped);
    S.photos.push(p);
    var idx = S.photos.length - 1;
    showReview(idx);
    adminAt(p.lon, p.lat).then(function (a) { p.admin = a; stamp(p); p.thumb = thumbOf(p.stamped); if (S.view === 'rev') showReview(S.cur); });
  }
  function thumbOf(c) { var t = document.createElement('canvas'), s = 160 / Math.max(c.width, c.height); t.width = Math.round(c.width * s); t.height = Math.round(c.height * s); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', .8); }
  function shoot() {
    if (S.busy) return;
    var v = $('.gt-video', S.el);
    if (!S.stream || !v.videoWidth) { toast('Kamera belum siap.'); return; }
    var raw = fitCanvas(v, v.videoWidth, v.videoHeight), time = new Date(), heading = compass.h;
    $('.gt-cam', S.el).classList.add('flash'); setTimeout(function () { $('.gt-cam', S.el).classList.remove('flash'); }, 180);
    S.busy = true;
    waitFix(function (fix) {
      S.busy = false;
      if (!fix) { toast(gpsError(gps.err)); return; }
      stopCam();
      addPhoto({ raw: raw, time: time, lat: fix.lat, lon: fix.lon, acc: fix.acc, heading: heading, source: 'GPS perangkat saat pemotretan' });
    });
  }
  // Ambil pembacaan terbaik 10 detik terakhir; bila belum ada / masih lemah, tunggu sebentar.
  function waitFix(cb) {
    var best = gpsBest(10000);
    if (best && best.acc != null && best.acc <= FAIR) return cb(best);
    var lock = $('.gt-lock', S.el), t = $('.gt-lock-t', S.el), started = Date.now(), done = false;
    lock.hidden = false;
    function finish(f) { if (done) return; done = true; clearInterval(iv); lock.hidden = true; cb(f); }
    $('.gt-lock-go', S.el).onclick = function () { finish(gpsBest(30000) || gps.last); };
    var iv = setInterval(function () {
      var b = gpsBest(10000);
      t.textContent = b ? 'Akurasi saat ini ' + accText(b.acc) : gps.err ? gpsError(gps.err) : 'Menunggu sinyal GPS…';
      $('.gt-lock-go', S.el).hidden = !gps.last;
      if (b && b.acc != null && b.acc <= FAIR) finish(b);
      else if (Date.now() - started > 20000) finish(gpsBest(30000) || gps.last || null);
    }, 300);
  }
  function fromFile(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var ex = readExif(rd.result) || {}, url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var raw = fitCanvas(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url);
        var time = exifDate(ex.time) || new Date(file.lastModified || Date.now());
        if (ex.lat != null) { stopCam(); addPhoto({ raw: raw, time: time, lat: ex.lat, lon: ex.lon, acc: ex.acc != null ? ex.acc : null, heading: ex.heading != null ? ex.heading : null, source: 'Data GPS (EXIF) pada foto' }); return; }
        // Foto tanpa data GPS: pakai posisi perangkat, dan tandai dengan jelas di laporan.
        toast('Foto tidak menyimpan data lokasi. Koordinat diambil dari posisi perangkat saat ini.');
        S.busy = true;
        waitFix(function (fix) { S.busy = false; if (!fix) { toast(gpsError(gps.err)); return; } stopCam(); addPhoto({ raw: raw, time: time, lat: fix.lat, lon: fix.lon, acc: fix.acc, heading: null, source: 'Posisi perangkat saat foto dipilih (foto tanpa data GPS)', noGps: true }); });
      };
      img.onerror = function () { URL.revokeObjectURL(url); toast('Berkas ini bukan gambar yang dapat dibaca.'); };
      img.src = url;
    };
    rd.readAsArrayBuffer(file.slice(0, 256 * 1024));
  }
  function removePhoto(i) {
    S.photos.splice(i, 1);
    if (!S.photos.length) { showCam(); return; }
    showReview(Math.min(i, S.photos.length - 1));
  }
  function row(k, v, cls) { return '<div class="gt-row"><span>' + k + '</span><b' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</b></div>'; }
  function showReview(i) {
    S.view = 'rev'; S.cur = i; S.el.className = 'gt-shell open rev';
    var p = S.photos[i], m = tm3(p.lon, p.lat, p.admin && p.admin.regency), ad = p.admin;
    $('.gt-main', S.el).src = p.stamped.toDataURL('image/jpeg', .85);
    var strip = S.photos.map(function (q, k) { return '<button type="button" class="gt-tile' + (k === i ? ' on' : '') + '" data-k="' + k + '"><img src="' + q.thumb + '" alt=""><em>' + (k + 1) + '</em></button>'; }).join('');
    if (S.photos.length < MAX_PHOTOS) strip += '<button type="button" class="gt-tile gt-add" aria-label="Tambah foto"><i class="fas fa-plus"></i><small>Foto</small></button>';
    var st = $('.gt-strip', S.el); st.innerHTML = strip;
    st.querySelectorAll('[data-k]').forEach(function (b) { b.onclick = function () { showReview(+b.dataset.k); }; });
    var add = st.querySelector('.gt-add'); if (add) add.onclick = function () { showCam(); };
    var accCls = 'acc-' + accClass(p.acc);
    $('.gt-info', S.el).innerHTML =
      row('Lokasi', ad ? esc(placeLine(ad) || 'Tidak diketahui') : '<i class="gt-wait">Mencari desa…</i>')
      + row('Koordinat', p.lat.toFixed(6) + ', ' + p.lon.toFixed(6))
      + row('TM-3 ' + m.zone, 'X ' + idNum(m.x) + ' · Y ' + idNum(m.y))
      + row('Akurasi', p.acc != null ? accText(p.acc) + (p.acc > FAIR ? ' — lemah' : p.acc > GOOD ? ' — cukup' : ' — baik') : 'Tidak tercatat', accCls)
      + (p.heading != null ? row('Arah kamera', dirName(p.heading) + ' ' + Math.round(p.heading) + '°') : '')
      + row('Waktu', esc(fmtDate(p.time)) + ', ' + fmtTime(p.time) + ' ' + tzName(p.time))
      + row('Sumber koordinat', esc(p.source), p.noGps ? 'acc-poor' : '');
  }
  function savePhoto() {
    var p = S.photos[S.cur]; if (!p) return;
    var name = 'BaleRuangNTB_Foto_' + fileStamp(p.time) + '.jpg';
    p.stamped.toBlob(function (blob) {
      var file = window.File ? new File([blob], name, { type: 'image/jpeg' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: name }).catch(function () {}); return; }
      var a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 30000);
    }, 'image/jpeg', .92);
  }
  function fileStamp(d) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()); }

  // ---------- Laporan PDF ----------
  function loadQr() {
    return new Promise(function (res) {
      if (window.qrcode) return res(window.qrcode);
      var s = document.createElement('script'); s.src = 'js/qrcode.js?v=1'; s.onload = function () { res(window.qrcode || null); }; s.onerror = function () { res(null); }; document.head.appendChild(s);
    });
  }
  function qrSvg(text) { try { var q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); } catch (e) { return ''; } }
  function makePdf() {
    if (!S.photos.length) return;
    var pending = S.photos.some(function (p) { return !p.admin; });
    var btn = $('.gt-pdf', S.el); btn.disabled = true; btn.innerHTML = '<span class="gt-spin sm"></span> Menyiapkan…';
    var ready = Promise.all(S.photos.map(function (p) { return p.admin ? p : adminAt(p.lon, p.lat).then(function (a) { p.admin = a; stamp(p); return p; }); }));
    Promise.all([ready, loadQr()]).then(function () {
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-pdf"></i> Buat PDF';
      var w = window.open('', '_blank'); // ditangani aplikasi sebagai bingkai cetak
      if (!w) { toast('Browser memblokir jendela cetak. Izinkan pop-up untuk Bale Ruang NTB.'); return; }
      w.document.open(); w.document.write(reportHtml()); w.document.close();
    }).catch(function () { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-pdf"></i> Buat PDF'; toast('Laporan gagal disiapkan. Coba lagi.'); });
    void pending;
  }
  function reportHtml() {
    var ps = S.photos, p0 = ps[0], ad = p0.admin || {}, n = ps.length;
    var title = $('.gt-in-title', S.el).value.trim(), note = $('.gt-in-note', S.el).value.trim(), officer = $('.gt-in-off', S.el).value.trim();
    var maps = 'https://www.google.com/maps?q=' + p0.lat.toFixed(7) + ',' + p0.lon.toFixed(7);
    var base = location.origin + location.pathname.replace(/[^\/]*$/, ''), abs = function (u) { return new URL(u, location.href).href; };
    var fileName = 'BaleRuangNTB_Geotag_' + String(ad.village || 'Lokasi').replace(/[^A-Za-z0-9]+/g, '') + '_' + fileStamp(p0.time);
    var docNo = 'GT-' + fileStamp(p0.time).replace('_', '-');
    var photos = ps.map(function (p, k) {
      return '<figure class="ph"><img src="' + p.stamped.toDataURL('image/jpeg', .9) + '" alt="Foto ' + (k + 1) + '">' + (n > 1 ? '<span class="no">' + (k + 1) + '</span>' : '') + '</figure>';
    }).join('');
    var pts = ps.map(function (p, k) {
      var m = tm3(p.lon, p.lat, (p.admin || {}).regency);
      return '<tr>' + (n > 1 ? '<td class="n">' + (k + 1) + '</td>' : '') + '<td>' + p.lat.toFixed(6) + ', ' + p.lon.toFixed(6) + '<small>' + dms(p.lat, 'LU', 'LS') + ' ' + dms(p.lon, 'BT', 'BB') + '</small></td>'
        + '<td>X ' + idNum(m.x) + '<br>Y ' + idNum(m.y) + '<small>TM-3 ' + m.zone + '</small></td>'
        + '<td>' + (p.acc != null ? '± ' + Math.round(p.acc) + ' m' : '–') + (p.heading != null ? '<small>' + dirName(p.heading) + ' ' + Math.round(p.heading) + '°</small>' : '') + '</td>'
        + '<td>' + fmtTime(p.time) + '<small>' + p.time.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + '</small></td></tr>';
    }).join('');
    var srcs = ps.filter(function (p) { return p.noGps; }).length ? '<p class="warn">Sebagian koordinat diambil dari posisi perangkat karena foto tidak menyimpan data GPS.</p>' : '';
    var marks = JSON.stringify(ps.map(function (p) { return [p.lat, p.lon]; }));
    var css = '@page{size:A4 portrait;margin:12mm 12mm 14mm}*{box-sizing:border-box}html,body{margin:0}body{color:#1d1d1f;font:9pt/1.4 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.hd{display:flex;align-items:center;justify-content:space-between;padding-bottom:3mm;border-bottom:.3mm solid #d2d2d7}.brand{display:flex;align-items:center;gap:2.5mm}.brand img{width:8mm;height:8mm}.brand b{display:block;font-size:10pt}.brand span{font-size:7pt;color:#6e6e73}.meta{text-align:right;font-size:7pt;color:#6e6e73;letter-spacing:.04em}.meta b{display:block;color:#1d1d1f;font-size:8pt;letter-spacing:.12em}'
      + 'h1{margin:5mm 0 .8mm;font-size:16pt;font-weight:600;letter-spacing:-.01em}.sub{margin:0 0 4mm;color:#6e6e73;font-size:9pt}'
      + '.photos{display:grid;gap:2.5mm;height:' + (n === 1 ? '118mm' : '122mm') + ';grid-template-columns:' + (n === 1 ? '1fr' : '1fr 1fr') + ';grid-template-rows:' + (n <= 2 ? '1fr' : '1fr 1fr') + '}'
      + '.ph{position:relative;margin:0;border-radius:2.5mm;overflow:hidden;background:' + (n === 1 ? '#f2f2f4' : '#1c1c1e') + '}.ph img{width:100%;height:100%;object-fit:contain;display:block}.ph .no{position:absolute;left:2mm;top:2mm;width:5.5mm;height:5.5mm;border-radius:50%;background:#fff;color:#1d1d1f;font-size:8pt;font-weight:600;display:grid;place-items:center;box-shadow:0 .3mm 1mm rgba(0,0,0,.3)}'
      + '.low{display:grid;grid-template-columns:62mm 1fr;gap:5mm;margin-top:5mm}.map{position:relative;height:62mm;border-radius:2.5mm;overflow:hidden;background:#e8e8ed}#map{position:absolute;inset:0}.north{position:absolute;z-index:500;right:2mm;top:2mm;width:6mm;height:6mm;border-radius:50%;background:rgba(255,255,255,.92);display:grid;place-items:center;font-size:6.5pt;font-weight:700}'
      + '.lbl{margin:0 0 1.2mm;color:#6e6e73;font-size:6.8pt;font-weight:600;letter-spacing:.08em;text-transform:uppercase}.kv{display:grid;grid-template-columns:26mm 1fr;gap:.8mm 3mm;margin:0 0 3.5mm}.kv span{color:#6e6e73}.kv b{font-weight:500}'
      + 'table{width:100%;border-collapse:collapse;font-size:8pt}th{text-align:left;font-weight:500;color:#6e6e73;font-size:6.8pt;padding:0 2mm 1mm 0;border-bottom:.3mm solid #d2d2d7}td{vertical-align:top;padding:1.4mm 2mm 1.4mm 0;border-bottom:.2mm solid #e5e5ea;font-variant-numeric:tabular-nums}td small{display:block;color:#8a8a8e;font-size:6.6pt}td.n{font-weight:600;width:4mm}'
      + '.qr{display:flex;align-items:center;gap:3mm;margin-top:3.5mm}.qr svg{width:19mm;height:19mm;flex:0 0 19mm}.qr p{margin:0;color:#6e6e73;font-size:7pt}.qr p b{display:block;color:#1d1d1f;font-size:8pt;font-weight:600}'
      + '.note{margin-top:4mm;padding:2.5mm 3mm;border-radius:2mm;background:#f5f5f7;font-size:8.5pt;white-space:pre-wrap}.warn{margin:2mm 0 0;color:#b25000;font-size:7pt}'
      + '.page{display:flex;flex-direction:column;height:270mm}.ft{margin-top:auto;padding-top:2.5mm;border-top:.2mm solid #e5e5ea;display:flex;justify-content:space-between;color:#8a8a8e;font-size:6.8pt}.ft a{color:#8a8a8e;text-decoration:none}'
      + '.mk{width:5mm;height:5mm;margin:-2.5mm 0 0 -2.5mm;border-radius:50%;background:#007aff;border:.5mm solid #fff;color:#fff;font:600 6.5pt/4mm Arial;text-align:center;box-shadow:0 .3mm 1mm rgba(0,0,0,.45)}.leaflet-control-attribution{display:none}.leaflet-control-scale-line{font-size:6pt;padding:0 1mm}@media screen{body{max-width:186mm;margin:8mm auto}}';
    return '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>' + esc(fileName) + '</title><link rel="stylesheet" href="' + abs('css/leaflet.css') + '"><style>' + css + '</style></head><body><div class="page">'
      + '<header class="hd"><div class="brand"><img src="' + abs('images/bale-ruang-ntb-logo-v3.png') + '" alt=""><div><b>Bale Ruang NTB</b><span>Satu Tempat, Seluruh Informasi Ruang</span></div></div><div class="meta"><b>DOKUMENTASI GEOTAG</b>' + esc(docNo) + '</div></header>'
      + '<h1>' + esc(title || 'Dokumentasi Lapangan') + '</h1><p class="sub">' + esc([ad.village && 'Desa/Kel. ' + ad.village, ad.district && 'Kec. ' + ad.district, ad.regency, ad.province].filter(Boolean).join(', ') || 'Lokasi pada koordinat di bawah') + ' · ' + esc(fmtDate(p0.time)) + '</p>'
      + '<section class="photos">' + photos + '</section>'
      + '<section class="low"><div class="map"><div id="map"></div><span class="north">U</span></div><div>'
      + '<p class="lbl">Lokasi</p><div class="kv"><span>Desa/Kelurahan</span><b>' + esc(ad.village || '–') + '</b><span>Kecamatan</span><b>' + esc(ad.district || '–') + '</b><span>Kabupaten/Kota</span><b>' + esc(ad.regency || '–') + '</b><span>Provinsi</span><b>' + esc(ad.province || '–') + '</b></div>'
      + '<p class="lbl">Koordinat</p><table><thead><tr>' + (n > 1 ? '<th></th>' : '') + '<th>Lintang, Bujur (WGS84)</th><th>TM-3</th><th>Akurasi</th><th>Waktu</th></tr></thead><tbody>' + pts + '</tbody></table>' + srcs
      + '<div class="qr">' + qrSvg(maps) + '<p><b>Buka lokasi di peta</b>Pindai kode ini untuk membuka titik ' + (n > 1 ? 'foto 1 ' : '') + 'di Google Maps.</p></div></div></section>'
      + (note ? '<div class="note">' + esc(note) + '</div>' : '')
      + '<footer class="ft"><span>' + (officer ? 'Petugas: ' + esc(officer) + ' · ' : '') + 'Dibuat ' + esc(new Date().toLocaleString('id-ID')) + '</span><a href="' + esc(base) + '">Bale Ruang NTB · ' + esc(base.replace(/^https?:\/\//, '')) + '</a></footer></div>'
      + '<script src="' + abs('js/leaflet.js') + '"><\/script><script>(function(){var pts=' + marks + ',name=' + JSON.stringify(fileName) + ';document.title=name;'
      + 'function go(){var done=false;function print(){if(done)return;done=true;setTimeout(function(){document.title=name;try{parent.document.title=name}catch(e){}window.focus();window.print()},600)}'
      + 'try{var map=L.map("map",{zoomControl:false,attributionControl:false,fadeAnimation:false,zoomAnimation:false}),t=L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",{maxZoom:20,maxNativeZoom:20}).addTo(map);'
      + 'pts.forEach(function(p,i){L.marker(p,{icon:L.divIcon({className:"",html:"<div class=mk>"+(pts.length>1?i+1:"")+"</div>",iconSize:[0,0]})}).addTo(map)});'
      + 'if(pts.length>1)map.fitBounds(pts,{padding:[18,18],maxZoom:19});else map.setView(pts[0],18);L.control.scale({imperial:false,position:"bottomleft"}).addTo(map);t.on("load",print)}catch(e){}'
      + 'var imgs=[].slice.call(document.images),left=imgs.length;setTimeout(print,4500);}'
      + 'if(document.readyState==="complete")go();else window.addEventListener("load",go)})();<\/script></body></html>';
  }

  function init() {
    var menu = document.querySelector('.lontar-toolbox-menu');
    if (!menu || menu.querySelector('[data-geotag-report]')) return;
    var b = document.createElement('button'); b.className = 'lontar-toolbox-item'; b.type = 'button'; b.dataset.geotagReport = '1';
    b.innerHTML = '<i class="fas fa-camera"></i>Foto & PDF Geotag';
    b.onclick = function () { menu.classList.remove('open'); open(); };
    menu.appendChild(b);
  }
  window.brGeotagOpen = open;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
