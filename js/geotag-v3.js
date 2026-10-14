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
  // Kompas HP mengacu ke utara magnetis; dikoreksi deklinasi magnetis NTB (± 1° ke timur, perkiraan WMM 2025)
  // sehingga arah yang dicatat mengacu ke UTARA SEJATI (utara geografis).
  var DECL = 1.0, EXACT_TOL = 2;
  function toTrue(mag) { return ((mag + DECL) % 360 + 360) % 360; }
  var CARD = ['Utara', 'Timur', 'Selatan', 'Barat'];
  function exactCardinal(h) { if (h == null) return null; var k = Math.round(h / 90) % 4, d = Math.abs(((h - k * 90) + 540) % 360 - 180); return d <= EXACT_TOL ? CARD[k] : null; }
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
      if (typeof e.beta === 'number' && typeof e.gamma === 'number') { compass.b = e.beta; compass.g = e.gamma; compass.t = Date.now(); }
      var h = null;
      if (typeof e.webkitCompassHeading === 'number') {
        h = e.webkitCompassHeading + ((screen.orientation && screen.orientation.angle) || window.orientation || 0);
      } else if (e.absolute && typeof e.alpha === 'number') {
        // Arah lensa belakang (sumbu -Z perangkat) dari matriks rotasi W3C: benar untuk posisi tegak maupun miring/lanskap.
        var d = Math.PI / 180, a = e.alpha * d, b = (e.beta || 0) * d, g = (e.gamma || 0) * d;
        var r13 = Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g),
          r23 = Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g),
          r33 = Math.cos(b) * Math.cos(g);
        h = Math.abs(r33) > 0.94 ? 360 - e.alpha : Math.atan2(-r13, -r23) / d; // HP mendatar: pakai arah sisi atas
      }
      if (h == null) return;
      compass.h = toTrue(h);
    }
    var go = function () { window.addEventListener('deviceorientationabsolute', onOri, true); window.addEventListener('deviceorientation', onOri, true); };
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(function (s) { if (s === 'granted') go(); }).catch(function () {});
    else go();
  }

  // Posisi fisik HP dari sensor gravitasi: 0 = tegak, -90 = diputar berlawanan jarum jam (sisi kanan di atas), 90 = searah jarum jam.
  function physicalTurn() {
    if (compass.b == null || Date.now() - (compass.t || 0) > 3000) return 0;
    var d = Math.PI / 180, ux = -Math.cos(compass.b * d) * Math.sin(compass.g * d), uy = Math.sin(compass.b * d);
    if (Math.abs(ux) < 0.55 || Math.abs(ux) < Math.abs(uy) * 1.2) return 0;
    return ux > 0 ? -90 : 90;
  }
  function rotateCanvas(c, deg) {
    var r = document.createElement('canvas'); r.width = c.height; r.height = c.width;
    var g = r.getContext('2d'); g.translate(r.width / 2, r.height / 2); g.rotate(deg * Math.PI / 180); g.drawImage(c, -c.width / 2, -c.height / 2);
    return r;
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
        if (g[0x11] && g[0x11].type === 5) { res.heading = rat(t + u32(g[0x11].at)); if (g[0x10] && String.fromCharCode(v.getUint8(g[0x10].at)) === 'M') res.heading = toTrue(res.heading); }
      }
    }
    return res;
  }
  function exifDate(s) { var m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(s || ''); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null; }

  // ---------- Foto + cap ----------
  function fitCanvas(src, w, h) {
    var max = 3200, s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c;
  }
  var logoImg = null;
  function logo() { if (!logoImg) { logoImg = new Image(); logoImg.src = 'images/bale-ruang-ntb-logo-v3.png'; } return logoImg; }
  function fmtDate(d) { return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function tzName(d) { var o = -d.getTimezoneOffset() / 60; return o === 7 ? 'WIB' : o === 8 ? 'WITA' : o === 9 ? 'WIT' : 'UTC' + (o >= 0 ? '+' : '') + o; }
  // Infografis JPG: foto utuh di atas + panel informasi di bawahnya (tinggi gambar bertambah, foto tidak ditimpa).
  var FONT = '-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  function fitText(g, t, maxW) { t = String(t || ''); if (g.measureText(t).width <= maxW) return t; while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; }
  function txt(g, t, x, y, size, weight, color, maxW, align) {
    g.font = (weight || 400) + ' ' + size + 'px ' + FONT; g.fillStyle = color || '#fff'; g.textAlign = align || 'left';
    g.fillText(maxW ? fitText(g, t, maxW) : t, x, y); g.textAlign = 'left';
  }
  function dial(g, cx, cy, r, heading) {
    g.save();
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    for (var i = 0; i < 72; i++) {
      var a = i * 5 * Math.PI / 180, major = i % 18 === 0, len = major ? 14 : (i % 6 === 0 ? 9 : 5);
      g.strokeStyle = major ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.28)'; g.lineWidth = major ? 3 : 1.5;
      g.beginPath(); g.moveTo(cx + Math.sin(a) * (r - 4), cy - Math.cos(a) * (r - 4)); g.lineTo(cx + Math.sin(a) * (r - 4 - len), cy - Math.cos(a) * (r - 4 - len)); g.stroke();
    }
    ['U', 'T', 'S', 'B'].forEach(function (l, i) { var a = i * Math.PI / 2; txt(g, l, cx + Math.sin(a) * (r - 34), cy - Math.cos(a) * (r - 34) + 8, 22, i ? 500 : 700, i ? 'rgba(255,255,255,.6)' : '#ff453a', 0, 'center'); });
    if (heading != null) {
      g.translate(cx, cy); g.rotate(heading * Math.PI / 180);
      g.fillStyle = '#0a84ff'; g.beginPath(); g.moveTo(0, -(r - 54)); g.lineTo(11, 0); g.lineTo(-11, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(0, r - 54); g.lineTo(11, 0); g.lineTo(-11, 0); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  // Rasio akhir dirancang: foto lanskap -> 4:5 (seperti unggahan potret), foto potret -> 9:16 (seperti story).
  function mapsUrl(p) { return 'https://www.google.com/maps/search/?api=1&query=' + p.lat.toFixed(7) + ',' + p.lon.toFixed(7); }
  function drawQr(g, text, x, y, size) {
    if (!window.qrcode) return false;
    try {
      var q = window.qrcode(0, 'M'); q.addData(text); q.make();
      var n = q.getModuleCount(), quiet = 10, cell = (size - quiet * 2) / n;
      g.fillStyle = '#fff'; roundRect(g, x, y, size, size, 18); g.fill();
      g.fillStyle = '#111214';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(Math.floor(x + quiet + c * cell), Math.floor(y + quiet + r * cell), Math.ceil(cell), Math.ceil(cell));
      return true;
    } catch (e) { return false; }
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function stamp(p) {
    // Panel dirancang pada lebar logis 1440 lalu digambar pada resolusi keluaran (OUT_W) agar teks tetap tajam.
    var OUT_W = Math.min(2160, Math.max(1440, p.raw.width)), k = OUT_W / 1440;
    var W = 1440, src = p.raw, phL = src.height * W / src.width, pad = 72;
    var target = phL > W * 1.05 ? W * 16 / 9 : phL < W * 0.95 ? W * 5 / 4 : W * 1.45;
    var P = Math.round(Math.max(600, Math.min(780, target - phL))), extra = P - 600, gap = extra / 3;
    var PH = Math.round(src.height * OUT_W / src.width);
    var c = document.createElement('canvas'); c.width = OUT_W; c.height = PH + Math.round(P * k);
    var g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, OUT_W, PH);
    g.setTransform(k, 0, 0, k, 0, PH);
    var ph = 0;
    g.fillStyle = '#111214'; g.fillRect(0, -1, W, P + 2);
    var ad = p.admin || {}, m = tm3(p.lon, p.lat, ad.regency), y0 = ph + gap * 0.9;
    // baris atas: tanggal & waktu | merek
    txt(g, fmtDate(p.time), pad, y0 + 92, 30, 500, 'rgba(255,255,255,.72)');
    txt(g, fmtTime(p.time) + ' ' + tzName(p.time), pad, y0 + 158, 58, 300, '#fff');
    var L = logo(), lx = W - pad - 300;
    if (L.complete && L.naturalWidth) g.drawImage(L, lx, y0 + 64, 76, 76);
    txt(g, 'Bale Ruang NTB', lx + 92, y0 + 100, 30, 600, '#fff');
    txt(g, 'Dokumentasi Geotag', lx + 92, y0 + 134, 22, 400, 'rgba(255,255,255,.55)');
    g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(pad, y0 + 200, W - pad * 2, 2);
    // kolom: lokasi | koordinat | arah
    var cy = y0 + 262 + gap * 0.6, cw = 430, c2 = pad + cw + 50, dialX = W - pad - 128, dialY = cy + 110;
    txt(g, 'LOKASI', pad, cy, 19, 600, 'rgba(255,255,255,.45)');
    txt(g, ad.village ? 'Desa/Kel. ' + ad.village : 'Lokasi tidak diketahui', pad, cy + 50, 34, 600, '#fff', cw);
    txt(g, ad.district ? 'Kec. ' + ad.district : '', pad, cy + 94, 26, 400, 'rgba(255,255,255,.75)', cw);
    txt(g, ad.regency || ad.province || '', pad, cy + 132, 26, 400, 'rgba(255,255,255,.75)', cw);
    txt(g, 'KOORDINAT', c2, cy, 19, 600, 'rgba(255,255,255,.45)');
    txt(g, p.lat.toFixed(6) + ', ' + p.lon.toFixed(6), c2, cy + 50, 34, 500, '#fff', dialX - 150 - c2);
    txt(g, dms(p.lat, 'LU', 'LS') + '  ' + dms(p.lon, 'BT', 'BB'), c2, cy + 94, 24, 400, 'rgba(255,255,255,.75)', dialX - 150 - c2);
    txt(g, 'TM-3 ' + m.zone + '   X ' + idNum(m.x) + '   Y ' + idNum(m.y), c2, cy + 132, 24, 400, 'rgba(255,255,255,.75)', dialX - 150 - c2);
    // QR lokasi (dapat dipindai) menggantikan kompas; derajat arah tetap ditulis di bawahnya.
    var qs = 212, qx = dialX - qs / 2, qy = dialY - qs / 2 - 14;
    if (!drawQr(g, mapsUrl(p), qx, qy, qs)) dial(g, dialX, dialY, 112, p.heading);
    var ex = exactCardinal(p.heading), hy = dialY + 158;
    if (p.heading == null) txt(g, 'Arah tidak tersedia', dialX, hy, 24, 500, 'rgba(255,255,255,.5)', 300, 'center');
    else {
      var label = Math.round(p.heading) + '° ' + (ex ? 'Tepat ' + ex : dirName(p.heading));
      g.font = '600 26px ' + FONT; var tw = g.measureText(label).width + 34, tx = dialX - tw / 2;
      g.save(); g.translate(tx + 12, hy - 9); g.rotate(p.heading * Math.PI / 180); g.fillStyle = ex ? '#30d158' : '#0a84ff'; g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 9); g.lineTo(0, 5); g.lineTo(-7, 9); g.closePath(); g.fill(); g.restore();
      txt(g, label, tx + 34, hy, 26, 600, ex ? '#30d158' : '#fff');
    }
    // baris bawah: akurasi & sumber (sejajar teks di bawah kompas)
    var by = dialY + 158, col = p.acc == null ? '#8e8e93' : p.acc <= GOOD ? '#30d158' : p.acc <= FAIR ? '#ffd60a' : '#ff453a';
    g.fillStyle = col; g.beginPath(); g.arc(pad + 9, by - 9, 9, 0, Math.PI * 2); g.fill();
    txt(g, 'Akurasi ' + (p.acc != null ? '± ' + Math.round(p.acc) + ' m' : 'tidak tercatat'), pad + 30, by, 26, 600, '#fff');
    txt(g, p.source || '', c2, by, 22, 400, 'rgba(255,255,255,.5)', dialX - 160 - c2);
    g.setTransform(1, 0, 0, 1, 0, 0);
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
      + '<button type="button" class="gt-chip gt-native" aria-label="Pakai kamera bawaan HP"><i class="fas fa-mobile-alt"></i><b>Kamera HP</b></button>'
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
      + '<label><span>Judul</span><input class="gt-in-title" maxlength="80" placeholder="Opsional, tampil sebagai judul laporan"></label>'
      + '<label><span>Keterangan</span><textarea class="gt-in-note" rows="2" maxlength="400" placeholder="Opsional"></textarea></label>'
      + '<label><span>Petugas</span><input class="gt-in-off" maxlength="60" placeholder="Opsional"></label></div>'
      + '<p class="gt-foot">Koordinat dikunci saat foto diambil. Akurasi di bawah ± ' + GOOD + ' m sangat baik; di atas ± ' + FAIR + ' m sebaiknya ulangi di area terbuka.</p></div>'
      + '<footer class="gt-actions"><button type="button" class="gt-btn gt-save"><i class="fas fa-download"></i> Simpan foto</button><button type="button" class="gt-btn gt-primary gt-pdf"><i class="fas fa-file-pdf"></i> Buat PDF</button></footer>'
      + '</section><input type="file" class="gt-file" accept="image/jpeg,image/*" hidden><input type="file" class="gt-native-in" accept="image/*" capture="environment" hidden>';
    document.body.appendChild(el); S.el = el;
    $('.gt-x', el).onclick = closeAll;
    $('.gt-done', el).onclick = closeAll;
    $('.gt-back', el).onclick = function () { showCam(); };
    $('.gt-shutter', el).onclick = shoot;
    $('.gt-gal', el).onclick = function () { $('.gt-file', el).click(); };
    $('.gt-native', el).onclick = function () { gpsStart(); $('.gt-native-in', el).click(); };
    $('.gt-native-in', el).onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (f) fromNative(f); };
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
  var lastExact = null;
  function updateDir() {
    var d = $('.gt-dir', S.el);
    if (compass.h == null) { d.hidden = true; return; }
    var ex = exactCardinal(compass.h);
    d.hidden = false; d.classList.toggle('exact', !!ex);
    d.innerHTML = '<i class="fas fa-location-arrow" style="transform:rotate(' + (compass.h - 45) + 'deg)"></i>' + Math.round(compass.h) + '° ' + (ex ? 'Tepat ' + ex : dirName(compass.h));
    if (ex && ex !== lastExact && navigator.vibrate) navigator.vibrate(25);
    lastExact = ex;
  }
  function startCam() {
    if (S.stream || !S.el) return;
    var v = $('.gt-video', S.el), err = $('.gt-camerr', S.el);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { err.hidden = false; $('.gt-camerr-t', S.el).textContent = 'Browser ini tidak mendukung kamera. Gunakan tombol galeri untuk memilih foto.'; return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 } }, audio: false }).then(function (st) {
      if (S.view !== 'cam') { st.getTracks().forEach(function (t) { t.stop(); }); return; }
      S.stream = st; v.srcObject = st; err.hidden = true; v.play().catch(function () {});
      // Jalur foto resolusi penuh (Chrome Android): ImageCapture.takePhoto, bukan bingkai video.
      var track = st.getVideoTracks()[0]; S.ic = null; S.photoW = 0;
      try { if (track && track.applyConstraints) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {}); } catch (e) {}
      if (track && window.ImageCapture) {
        try {
          S.ic = new ImageCapture(track);
          S.ic.getPhotoCapabilities().then(function (c) { S.photoW = c && c.imageWidth && c.imageWidth.max || 0; }).catch(function () {});
        } catch (e) { S.ic = null; }
      }
    }).catch(function (e) {
      err.hidden = false;
      $('.gt-camerr-t', S.el).textContent = e && e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan situs, atau pilih foto dari galeri.' : 'Kamera tidak ditemukan atau sedang dipakai aplikasi lain. Anda tetap bisa memilih foto dari galeri.';
    });
  }
  function stopCam() { S.ic = null; if (S.stream) { S.stream.getTracks().forEach(function (t) { t.stop(); }); S.stream = null; } if (S.el) $('.gt-video', S.el).srcObject = null; }
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
    compassStart(); loadQr();
    showCam();
  }
  function closeAll() { stopCam(); gpsStop(); S.view = ''; if (S.el) S.el.className = 'gt-shell'; }

  function addPhoto(p) {
    p.admin = null;
    stamp(p); p.thumb = thumbOf(p.raw);
    S.photos.push(p);
    var idx = S.photos.length - 1;
    showReview(idx);
    adminAt(p.lon, p.lat).then(function (a) { p.admin = a; stamp(p); if (S.view === 'rev') showReview(S.cur); });
  }
  function thumbOf(c) { var t = document.createElement('canvas'), s = 160 / Math.max(c.width, c.height); t.width = Math.round(c.width * s); t.height = Math.round(c.height * s); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', .8); }
  function tiny(c) { var t = document.createElement('canvas'); t.width = t.height = 24; var g = t.getContext('2d'); g.drawImage(c, 0, 0, 24, 24); var d = g.getImageData(0, 0, 24, 24).data, o = []; for (var i = 0; i < d.length; i += 4) o.push(d[i] + d[i + 1] + d[i + 2]); return o; }
  function diff(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s; }
  // Foto resolusi penuh; bila orientasinya berbeda dari pratinjau, putar ke arah yang paling cocok dengan pratinjau.
  function fullPhoto(preview) {
    if (!S.ic || !window.createImageBitmap) return Promise.reject();
    var opts = S.photoW && S.photoW > Math.max(preview.width, preview.height) ? { imageWidth: S.photoW } : {};
    var shot = S.ic.takePhoto(opts).catch(function () { return S.ic.takePhoto(); });
    var limit = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 7000); });
    return Promise.race([shot, limit]).then(function (blob) { return createImageBitmap(blob, { imageOrientation: 'from-image' }); }).then(function (bmp) {
      var c = fitCanvas(bmp, bmp.width, bmp.height); if (bmp.close) bmp.close();
      if ((c.width > c.height) !== (preview.width > preview.height)) {
        var ref = tiny(preview), a = rotateCanvas(c, 90), b2 = rotateCanvas(c, -90);
        c = diff(tiny(a), ref) <= diff(tiny(b2), ref) ? a : b2;
      }
      return c;
    });
  }
  function shoot() {
    if (S.busy) return;
    var v = $('.gt-video', S.el);
    if (!S.stream || !v.videoWidth) { toast('Kamera belum siap.'); return; }
    var preview = fitCanvas(v, v.videoWidth, v.videoHeight), time = new Date(), heading = compass.h;
    var turn = physicalTurn(), screenPortrait = window.innerHeight >= window.innerWidth;
    $('.gt-cam', S.el).classList.add('flash', 'saving'); setTimeout(function () { $('.gt-cam', S.el).classList.remove('flash'); }, 180);
    S.busy = true;
    var fixReady = new Promise(function (res) { waitFix(res); });
    var photoReady = fullPhoto(preview).catch(function () { return preview; });
    Promise.all([photoReady, fixReady]).then(function (r) {
      var raw = r[0], fix = r[1];
      $('.gt-cam', S.el).classList.remove('saving'); S.busy = false;
      // Layar terkunci potret tetapi HP dimiringkan (lanskap): putar hasil agar foto menjadi lanskap yang tegak.
      if (turn && screenPortrait && raw.height > raw.width) raw = rotateCanvas(raw, turn);
      if (!fix) { toast(gpsError(gps.err)); return; }
      stopCam();
      addPhoto({ raw: raw, time: time, lat: fix.lat, lon: fix.lon, acc: fix.acc, heading: heading, source: 'GPS perangkat saat pemotretan' });
    });
  }
  // Kamera bawaan HP (kualitas penuh: HDR, mode malam). Koordinat dikunci saat foto kembali ke aplikasi.
  function fromNative(file) {
    var rd = new FileReader();
    rd.onload = function () {
      var ex = readExif(rd.result) || {}, url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var raw = fitCanvas(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url);
        var time = exifDate(ex.time) || new Date();
        if (ex.lat != null) { stopCam(); addPhoto({ raw: raw, time: time, lat: ex.lat, lon: ex.lon, acc: ex.acc != null ? ex.acc : null, heading: ex.heading != null ? ex.heading : null, source: 'GPS kamera HP (data foto)' }); return; }
        S.busy = true;
        waitFix(function (fix) { S.busy = false; if (!fix) { toast(gpsError(gps.err)); return; } stopCam(); addPhoto({ raw: raw, time: time, lat: fix.lat, lon: fix.lon, acc: fix.acc, heading: ex.heading != null ? ex.heading : null, source: 'GPS perangkat saat memotret dengan kamera HP' }); });
      };
      img.onerror = function () { URL.revokeObjectURL(url); toast('Foto dari kamera HP tidak dapat dibaca.'); };
      img.src = url;
    };
    rd.readAsArrayBuffer(file.slice(0, 256 * 1024));
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
      + (p.heading != null ? row('Arah kamera', Math.round(p.heading) + '° ' + (exactCardinal(p.heading) ? 'Tepat ' + exactCardinal(p.heading) : dirName(p.heading)) + ' <small class="gt-sm">dari utara sejati</small>', exactCardinal(p.heading) ? 'acc-good' : '') : '')
      + row('Waktu', esc(fmtDate(p.time)) + ', ' + fmtTime(p.time) + ' ' + tzName(p.time))
      + row('Sumber koordinat', esc(p.source), p.noGps ? 'acc-poor' : '');
  }
  function savePhoto() {
    var p = S.photos[S.cur]; if (!p) return;
    var name = 'BaleRuangNTB_Geotag_' + fileStamp(p.time) + '.jpg';
    p.stamped.toBlob(function (blob) {
      // Langsung simpan ke perangkat (folder Unduhan), tanpa menu bagikan.
      var a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
      toast('Foto tersimpan di folder Unduhan: ' + name);
    }, 'image/jpeg', .93);
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
  function pdfImage(c) { var m = 2000, sc = Math.min(1, m / Math.max(c.width, c.height)); if (sc === 1) return c.toDataURL('image/jpeg', .88); var t = document.createElement('canvas'); t.width = Math.round(c.width * sc); t.height = Math.round(c.height * sc); var g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', .88); }
  function arrowSvg(h) { return '<svg class="arr" viewBox="0 0 10 10" style="transform:rotate(' + Math.round(h) + 'deg)"><path d="M5 .6 8.2 9 5 7.3 1.8 9z" fill="#007aff"/></svg>'; }
  function reportHtml() {
    var ps = S.photos, p0 = ps[0], ad = p0.admin || {}, n = ps.length;
    var title = $('.gt-in-title', S.el).value.trim(), note = $('.gt-in-note', S.el).value.trim(), officer = $('.gt-in-off', S.el).value.trim();
    var maps = 'https://www.google.com/maps/search/?api=1&query=' + p0.lat.toFixed(7) + ',' + p0.lon.toFixed(7);
    var base = location.origin + location.pathname.replace(/[^\/]*$/, ''), abs = function (u) { return new URL(u, location.href).href; };
    var fileName = 'BaleRuangNTB_Geotag_' + String(ad.village || 'Lokasi').replace(/[^A-Za-z0-9]+/g, '') + '_' + fileStamp(p0.time);
    var docNo = 'GT-' + fileStamp(p0.time).replace('_', '-');
    var place = [ad.village && 'Desa/Kel. ' + ad.village, ad.district && 'Kec. ' + ad.district, ad.regency].filter(Boolean).join(', ');
    // Tata letak foto ditentukan oleh jumlah & orientasi (lanskap/potret) agar seimbang.
    var portraitN = ps.filter(function (p) { return p.raw.height > p.raw.width * 1.05; }).length, PORT = portraitN * 2 > n || (n === 1 && portraitN === 1);
    var hero = n === 1 && PORT, GAP = 3, FULL = 186;
    var cols = n === 1 ? 1 : n === 2 ? 2 : n === 3 ? 3 : (PORT ? 4 : 2), rowsN = Math.ceil(n / cols);
    var cellW = (FULL - GAP * (cols - 1)) / cols, ratio = n === 1 ? p0.raw.height / p0.raw.width : (PORT ? 4 / 3 : 3 / 4);
    var cellH = cellW * ratio, cap = n === 1 ? 128 : (rowsN > 1 ? 100 : 122);
    if (cellH * rowsN + GAP * (rowsN - 1) > cap) cellH = (cap - GAP * (rowsN - 1)) / rowsN;
    var photoH = Math.round(cellH * rowsN + GAP * (rowsN - 1));
    var photos = ps.map(function (p, k) {
      return '<figure class="ph"><img src="' + pdfImage(p.raw) + '" alt="Foto ' + (k + 1) + '">' + (n > 1 ? '<span class="no">' + (k + 1) + '</span>' : '') + '</figure>';
    }).join('');
    var rows = ps.map(function (p, k) {
      var m = tm3(p.lon, p.lat, (p.admin || {}).regency);
      return '<tr><td class="n">' + (k + 1) + '</td>'
        + '<td>' + p.lat.toFixed(6) + ', ' + p.lon.toFixed(6) + '<small>' + dms(p.lat, 'LU', 'LS') + ' · ' + dms(p.lon, 'BT', 'BB') + '</small></td>'
        + '<td>X ' + idNum(m.x) + ' · Y ' + idNum(m.y) + '<small>TM-3 zona ' + m.zone + '</small></td>'
        + '<td class="c">' + (p.heading != null ? arrowSvg(p.heading) + Math.round(p.heading) + '°<small' + (exactCardinal(p.heading) ? ' class="ok">Tepat ' + exactCardinal(p.heading) : '>' + dirName(p.heading)) + '</small>' : '–') + '</td>'
        + '<td class="c">' + (p.acc != null ? '± ' + Math.round(p.acc) + ' m' : '–') + '<small>' + (p.noGps ? 'posisi perangkat' : p.source.indexOf('EXIF') >= 0 ? 'data foto' : 'GPS') + '</small></td>'
        + '<td class="c">' + fmtTime(p.time) + '<small>' + p.time.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + '</small></td></tr>';
    }).join('');
    var marks = JSON.stringify(ps.map(function (p) { return [p.lat, p.lon]; }));
    var mapCard = '<div class="card mapc"><div id="map"></div><span class="north">U</span></div>';
    var lokCard = '<div class="card"><h3>Lokasi</h3><div class="kv"><span>Desa/Kel.</span><b>' + esc(ad.village || '–') + '</b><span>Kecamatan</span><b>' + esc(ad.district || '–') + '</b><span>Kab/Kota</span><b>' + esc(ad.regency || '–') + '</b><span>Provinsi</span><b>' + esc(ad.province || '–') + '</b>' + (hero ? '' : '<span>Jumlah foto</span><b>' + n + '</b>') + '</div></div>';
    var css = '@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}html,body{margin:0}body{color:#1d1d1f;font:8.6pt/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      + '.page{display:flex;flex-direction:column;height:272mm}'
      + '.hd{display:flex;align-items:center;justify-content:space-between;padding-bottom:3mm;border-bottom:.25mm solid #d2d2d7}.brand{display:flex;align-items:center;gap:2.6mm}.brand img{width:8.5mm;height:8.5mm}.brand b{display:block;font-size:10pt;font-weight:600}.brand span{color:#86868b;font-size:7pt}'
      + '.meta{text-align:right;color:#86868b;font-size:7pt}.meta b{display:block;color:#1d1d1f;font-size:7.6pt;font-weight:600;letter-spacing:.14em}'
      + '.tt{display:flex;align-items:flex-end;justify-content:space-between;gap:6mm;margin:5mm 0 4mm}h1{margin:0;font-size:15pt;font-weight:600;letter-spacing:-.01em}.tt p{margin:1mm 0 0;color:#6e6e73;font-size:8.6pt}.date{text-align:right;white-space:nowrap}.date b{display:block;font-size:11pt;font-weight:500;font-variant-numeric:tabular-nums}.date span{color:#86868b;font-size:7.4pt}'
      + '.photos{display:grid;gap:' + GAP + 'mm;height:' + photoH + 'mm;grid-template-columns:repeat(' + cols + ',1fr);grid-template-rows:repeat(' + rowsN + ',1fr)}'
      + (n > 1 ? '.photos{flex:1 1 auto;height:auto;min-height:' + photoH + 'mm;max-height:' + Math.round(photoH * (n === 3 ? 1.9 : 1.6)) + 'mm}' : '')
      + '.hero{flex:1 1 auto;display:grid;grid-template-columns:96mm 1fr;gap:3mm;min-height:128mm;max-height:170mm}.hero .ph{height:auto}.hero .ph img{object-fit:cover}.side{display:grid;grid-template-rows:1fr auto 30mm;gap:3mm;min-height:0}.side .mapc{min-height:58mm}.side .card{height:auto}.qrc.row{flex-direction:row;justify-content:flex-start;gap:3.5mm;text-align:left}.qrc.row svg{width:22mm;height:22mm;flex:0 0 22mm}.qrc.row b{margin-top:0}.qrc.row div{display:flex;flex-direction:column}'
      + '.ph{position:relative;margin:0;border-radius:2.5mm;overflow:hidden;background:#f5f5f7}.ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:' + (n === 1 ? 'contain' : 'cover') + '}'
      + '.ph .no{position:absolute;left:2mm;top:2mm;width:5.6mm;height:5.6mm;border-radius:50%;background:rgba(255,255,255,.94);font-size:7.6pt;font-weight:600;display:grid;place-items:center;box-shadow:0 .2mm .8mm rgba(0,0,0,.25)}'
      + '.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:4mm;height:54mm}'
      + '.card{position:relative;border:.25mm solid #e5e5ea;border-radius:2.5mm;padding:3.2mm 3.6mm;overflow:hidden}.card h3{margin:0 0 2.4mm;color:#86868b;font-size:6.6pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase}'
      + '.mapc{padding:0}#map{position:absolute;inset:0}.north{position:absolute;z-index:500;right:2mm;top:2mm;width:6mm;height:6mm;border-radius:50%;background:rgba(255,255,255,.95);display:grid;place-items:center;font-size:6.5pt;font-weight:700;box-shadow:0 .2mm .6mm rgba(0,0,0,.25)}'
      + '.kv{display:grid;grid-template-columns:auto 1fr;gap:1.3mm 3mm}.kv span{color:#86868b}.kv b{font-weight:500;text-align:right}'
      + '.qrc{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;text-decoration:none;color:inherit}.qrc svg{width:27mm;height:27mm}.qrc b{margin-top:2.2mm;font-size:8pt;font-weight:600;color:#007aff}.qrc span{margin-top:.6mm;color:#86868b;font-size:6.8pt}'
      + 'table{width:100%;margin-top:4mm;border-collapse:collapse;font-size:8pt;font-variant-numeric:tabular-nums}th{padding:0 2mm 1.2mm;color:#86868b;font-size:6.6pt;font-weight:600;letter-spacing:.08em;text-transform:uppercase;text-align:left;border-bottom:.25mm solid #d2d2d7}th.c,td.c{text-align:center}'
      + 'td{padding:1.6mm 2mm;border-bottom:.2mm solid #ececf0;vertical-align:top}td small{display:block;color:#86868b;font-size:6.6pt}td.n{width:6mm;font-weight:600;color:#86868b}td small.ok{color:#248a3d;font-weight:600}.arr{width:2.6mm;height:2.6mm;margin-right:1mm;vertical-align:-.3mm}'
      + '.note{margin-top:4mm;padding:2.8mm 3.6mm;border-radius:2.5mm;background:#f5f5f7}.note h3{margin:0 0 1mm;color:#86868b;font-size:6.6pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase}.note p{margin:0;white-space:pre-wrap}'
      + '.ft{margin-top:auto;padding-top:2.6mm;border-top:.25mm solid #e5e5ea;display:flex;justify-content:space-between;color:#86868b;font-size:6.8pt}.ft a{color:#86868b;text-decoration:none}'
      + '.mk{width:5mm;height:5mm;margin:-2.5mm 0 0 -2.5mm;border-radius:50%;background:#007aff;border:.5mm solid #fff;color:#fff;font:600 6.4pt/4mm Arial;text-align:center;box-shadow:0 .3mm 1mm rgba(0,0,0,.45)}.leaflet-control-attribution{display:none}.leaflet-control-scale-line{font-size:6pt;padding:0 1mm}'
      + '@media screen{body{background:#e5e5ea}.page{width:186mm;margin:8mm auto;padding:0;background:#fff;box-shadow:0 0 0 12mm #fff}}';
    return '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>' + esc(fileName) + '</title><link rel="stylesheet" href="' + abs('css/leaflet.css') + '"><style>' + css + '</style></head><body><div class="page">'
      + '<header class="hd"><div class="brand"><img src="' + abs('images/bale-ruang-ntb-logo-v3.png') + '" alt=""><div><b>Bale Ruang NTB</b><span>Satu Tempat, Seluruh Informasi Ruang</span></div></div><div class="meta"><b>DOKUMENTASI GEOTAG</b>No. ' + esc(docNo) + '</div></header>'
      + '<section class="tt"><div><h1>' + esc(title || 'Dokumentasi Geotag') + '</h1><p>' + esc(place || 'Lokasi pada koordinat di bawah') + '</p></div><div class="date"><b>' + fmtTime(p0.time) + ' ' + tzName(p0.time) + '</b><span>' + esc(fmtDate(p0.time)) + '</span></div></section>'
      + (hero
        ? '<section class="hero"><figure class="ph">' + photos.replace(/^<figure class="ph">|<\/figure>$/g, '') + '</figure><div class="side">' + mapCard + lokCard + '<a class="card qrc row" href="' + esc(maps) + '" target="_blank" rel="noopener">' + qrSvg(maps) + '<div><b>Buka di Google Maps</b><span>Pindai atau klik kode ini</span></div></a></div></section>'
        : '<section class="photos">' + photos + '</section><section class="cards">' + mapCard + lokCard
          + '<a class="card qrc" href="' + esc(maps) + '" target="_blank" rel="noopener">' + qrSvg(maps) + '<b>Buka di Google Maps</b><span>Pindai atau klik' + (n > 1 ? ' · titik foto 1' : '') + '</span></a></section>')
      + '<table><thead><tr><th></th><th>Lintang, Bujur (WGS84)</th><th>Koordinat TM-3</th><th class="c">Arah (U. sejati)</th><th class="c">Akurasi</th><th class="c">Waktu</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + (note ? '<div class="note"><h3>Keterangan</h3><p>' + esc(note) + '</p></div>' : '')
      + '<footer class="ft"><span>' + (officer ? 'Petugas: ' + esc(officer) + ' · ' : '') + 'Dibuat ' + esc(new Date().toLocaleString('id-ID')) + '</span><a href="' + esc(base) + '">' + esc(base.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a></footer></div>'
      + '<script src="' + abs('js/leaflet.js') + '"><\/script><script>(function(){var pts=' + marks + ',name=' + JSON.stringify(fileName) + ';document.title=name;'
      + 'function go(){var done=false;function print(){if(done)return;done=true;setTimeout(function(){document.title=name;try{parent.document.title=name}catch(e){}window.focus();window.print()},600)}'
      + 'try{var map=L.map("map",{zoomControl:false,attributionControl:false,fadeAnimation:false,zoomAnimation:false}),t=L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",{maxZoom:20,maxNativeZoom:20}).addTo(map);'
      + 'pts.forEach(function(p,i){L.marker(p,{icon:L.divIcon({className:"",html:"<div class=mk>"+(pts.length>1?i+1:"")+"</div>",iconSize:[0,0]})}).addTo(map)});'
      + 'if(pts.length>1)map.fitBounds(pts,{padding:[22,22],maxZoom:19});else map.setView(pts[0],18);L.control.scale({imperial:false,position:"bottomleft"}).addTo(map);t.on("load",print)}catch(e){}'
      + 'setTimeout(print,4500);}'
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
