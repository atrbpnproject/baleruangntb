/* Bale Ruang NTB — Rincian bidang untuk laporan PDF:
 * titik batas (koordinat, panjang sisi, azimut, arah hadap), sketsa batas bidang berskala,
 * fasilitas terdekat (Overture Maps, cadangan OpenStreetMap), serta tautan + QR yang membuka kembali bidang/titik di peta.
 * Berkas ini dipakai di aplikasi utama dan di jendela laporan (tanpa dependensi selain qrcode.js). */
(function (root) {
  'use strict';

  var PUBLIC_URL = 'https://atrbpnproject.github.io/baleruangntb/';
  var OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  var FACILITY_RADIUS = 3000, QR_MAX_URL = 850, TABLE_MAX_ROWS = 400;

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v, dec) { return Number(v).toLocaleString('id-ID', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); }
  function fmtLength(m) { return m >= 1000 ? num(m / 1000, 3) + ' km' : num(m, 2) + ' m'; }
  function fmtDistance(m) { return m >= 1000 ? num(m / 1000, 1) + ' km' : (Math.round(m / 10) * 10) + ' m'; }

  /* ---------------- Geodesi (WGS84) ---------------- */
  var A = 6378137, F = 1 / 298.257223563, B = A * (1 - F), E2 = F * (2 - F), EP2 = E2 / (1 - E2), RAD = Math.PI / 180;

  // Vincenty inverse: jarak elipsoid (m) dan azimut awal (derajat dari utara sejati).
  function inverse(lat1, lon1, lat2, lon2) {
    if (lat1 === lat2 && lon1 === lon2) return { dist: 0, az: 0 };
    var L = (lon2 - lon1) * RAD, U1 = Math.atan((1 - F) * Math.tan(lat1 * RAD)), U2 = Math.atan((1 - F) * Math.tan(lat2 * RAD));
    var sinU1 = Math.sin(U1), cosU1 = Math.cos(U1), sinU2 = Math.sin(U2), cosU2 = Math.cos(U2), lambda = L, iter = 0, lambdaP;
    var sinL, cosL, sinS, cosS, sigma, sinA, cos2A, cos2SM, C;
    do {
      sinL = Math.sin(lambda); cosL = Math.cos(lambda);
      sinS = Math.sqrt(Math.pow(cosU2 * sinL, 2) + Math.pow(cosU1 * sinU2 - sinU1 * cosU2 * cosL, 2));
      if (sinS === 0) return { dist: 0, az: 0 };
      cosS = sinU1 * sinU2 + cosU1 * cosU2 * cosL; sigma = Math.atan2(sinS, cosS);
      sinA = cosU1 * cosU2 * sinL / sinS; cos2A = 1 - sinA * sinA;
      cos2SM = cos2A ? cosS - 2 * sinU1 * sinU2 / cos2A : 0;
      C = F / 16 * cos2A * (4 + F * (4 - 3 * cos2A));
      lambdaP = lambda;
      lambda = L + (1 - C) * F * sinA * (sigma + C * sinS * (cos2SM + C * cosS * (-1 + 2 * cos2SM * cos2SM)));
    } while (Math.abs(lambda - lambdaP) > 1e-12 && ++iter < 200);
    var u2 = cos2A * (A * A - B * B) / (B * B), AA = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2))), BB = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
    var dS = BB * sinS * (cos2SM + BB / 4 * (cosS * (-1 + 2 * cos2SM * cos2SM) - BB / 6 * cos2SM * (-3 + 4 * sinS * sinS) * (-3 + 4 * cos2SM * cos2SM)));
    var az = Math.atan2(cosU2 * sinL, cosU1 * sinU2 - sinU1 * cosU2 * cosL) / RAD;
    return { dist: B * AA * (sigma - dS), az: (az + 360) % 360 };
  }

  function utmZone(lon) { return Math.max(1, Math.min(60, Math.floor((lon + 180) / 6) + 1)); }
  // UTM (Snyder). Selatan khatulistiwa memakai false northing 10.000.000 m.
  function toUtm(lat, lon, zone) {
    var phi = lat * RAD, lon0 = ((zone - 1) * 6 - 180 + 3) * RAD, k0 = 0.9996;
    var sin = Math.sin(phi), cos = Math.cos(phi), tan = Math.tan(phi), N = A / Math.sqrt(1 - E2 * sin * sin), T = tan * tan, C = EP2 * cos * cos, Aa = cos * (lon * RAD - lon0);
    var e4 = E2 * E2, e6 = e4 * E2;
    var M = A * ((1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi) - (35 * e6 / 3072) * Math.sin(6 * phi));
    var x = k0 * N * (Aa + (1 - T + C) * Math.pow(Aa, 3) / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Math.pow(Aa, 5) / 120) + 500000;
    var y = k0 * (M + N * tan * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(Aa, 4) / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Math.pow(Aa, 6) / 720));
    if (lat < 0) y += 10000000;
    return [x, y];
  }

  /* ---------------- Ekstraksi geometri ---------------- */
  function collectPolygons(input, out) {
    out = out || [];
    if (!input) return out;
    if (input.type === 'FeatureCollection') (input.features || []).forEach(function (f) { collectPolygons(f, out); });
    else if (input.type === 'Feature') collectPolygons(input.geometry, out);
    else if (input.type === 'GeometryCollection') (input.geometries || []).forEach(function (g) { collectPolygons(g, out); });
    else if (input.type === 'Polygon') out.push(input.coordinates);
    else if (input.type === 'MultiPolygon') (input.coordinates || []).forEach(function (p) { out.push(p); });
    return out;
  }
  function openRing(ring) {
    var pts = [];
    (ring || []).forEach(function (p) {
      if (!p || !isFinite(p[0]) || !isFinite(p[1])) return;
      var last = pts[pts.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push([Number(p[0]), Number(p[1])]);
    });
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    return pts;
  }
  function planarArea(xy) { var s = 0; for (var i = 0, n = xy.length; i < n; i++) { var a = xy[i], b = xy[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function inRing(pt, xy) {
    var inside = false;
    for (var i = 0, j = xy.length - 1; i < xy.length; j = i++) {
      var a = xy[i], b = xy[j];
      if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function inPart(pt, partXY) { if (!inRing(pt, partXY[0])) return false; for (var i = 1; i < partXY.length; i++) if (inRing(pt, partXY[i])) return false; return true; }

  var WINDS = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  function wind(bearing) { return WINDS[Math.round(((bearing % 360) + 360) % 360 / 45) % 8]; }

  // Data bidang: bagian-bagian poligon, titik bernomor (searah jarum jam dari titik paling barat laut), sisi, keliling.
  function parcel(geometry) {
    var polys = collectPolygons(geometry), all = [];
    polys.forEach(function (poly) { poly.forEach(function (ring) { openRing(ring).forEach(function (p) { all.push(p); }); }); });
    if (!all.length) return null;
    var lonSum = 0; all.forEach(function (p) { lonSum += p[0]; });
    var zone = utmZone(lonSum / all.length), south = all[0][1] < 0, counter = 0, perimeter = 0, parts = [];
    polys.forEach(function (poly) {
      var rings = poly.map(openRing).filter(function (r) { return r.length >= 3; });
      if (!rings.length) return;
      // Ring luar searah jarum jam, mulai dari titik terdekat sudut barat laut kotak batas.
      var outer = rings[0], oxy = outer.map(function (p) { return toUtm(p[1], p[0], zone); });
      if (planarArea(oxy) > 0) { outer = outer.slice().reverse(); oxy = oxy.slice().reverse(); }
      var minX = Infinity, maxY = -Infinity; oxy.forEach(function (p) { if (p[0] < minX) minX = p[0]; if (p[1] > maxY) maxY = p[1]; });
      var start = 0, best = Infinity;
      oxy.forEach(function (p, i) { var d = Math.pow(p[0] - minX, 2) + Math.pow(maxY - p[1], 2); if (d < best - 1e-9) { best = d; start = i; } });
      outer = outer.slice(start).concat(outer.slice(0, start)); oxy = oxy.slice(start).concat(oxy.slice(0, start));
      var ringList = [{ ll: outer, xy: oxy, hole: false }].concat(rings.slice(1).map(function (r) { return { ll: r, xy: r.map(function (p) { return toUtm(p[1], p[0], zone); }), hole: true }; }));
      var partXY = ringList.map(function (r) { return r.xy; });
      ringList.forEach(function (r) {
        r.points = r.ll.map(function (p, i) { return { no: ++counter, lon: p[0], lat: p[1], x: r.xy[i][0], y: r.xy[i][1] }; });
        r.sides = r.points.map(function (p, i) {
          var q = r.points[(i + 1) % r.points.length], g = inverse(p.lat, p.lon, q.lat, q.lon);
          var dx = q.x - p.x, dy = q.y - p.y, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = dy / len, ny = -dx / len;
          var mid = [(p.x + q.x) / 2, (p.y + q.y) / 2];
          if (inPart([mid[0] + nx * 0.01, mid[1] + ny * 0.01], partXY)) { nx = -nx; ny = -ny; }
          perimeter += r.hole ? 0 : g.dist;
          var facing = (Math.atan2(nx, ny) / RAD + 360) % 360;
          return { from: p.no, to: q.no, length: g.dist, azimuth: g.az, facing: wind(facing), nx: nx, ny: ny };
        });
        r.length = r.sides.reduce(function (s, x) { return s + x.length; }, 0);
      });
      parts.push({ rings: ringList });
    });
    if (!parts.length) return null;
    return { zone: zone, south: south, parts: parts, perimeter: perimeter, count: counter };
  }

  function perimeter(geometry) { var p = parcel(geometry); return p ? p.perimeter : 0; }

  /* ---------------- Sketsa batas bidang (SVG, satuan mm) ---------------- */
  var SCALES = [100, 200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 25000, 50000, 100000, 250000];
  function niceBelow(v, list) { var best = list[0]; list.forEach(function (x) { if (x <= v) best = x; }); return best; }

  function sketchSvg(data, opts) {
    opts = opts || {};
    var W = opts.width || 190, H = opts.height || 100, pad = 14, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.parts.forEach(function (part) { part.rings.forEach(function (r) { r.points.forEach(function (p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }); }); });
    var bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1), scale = SCALES[SCALES.length - 1];
    for (var i = 0; i < SCALES.length; i++) { var s = SCALES[i]; if (bw * 1000 / s <= W - 2 * pad && bh * 1000 / s <= H - 2 * pad) { scale = s; break; } }
    var k = 1000 / scale, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    function X(x) { return W / 2 + (x - cx) * k; }
    function Y(y) { return H / 2 - (y - cy) * k; }
    var out = ['<svg class="br-sketch" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + 'mm" height="' + H + 'mm" font-family="Arial,sans-serif">',
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff" stroke="#17354d" stroke-width="0.35"/>'];
    // Grid UTM tipis + label tepi.
    var gridStep = niceBelow(25 / k, [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000]);
    var gx0 = cx - (W / 2) / k, gx1 = cx + (W / 2) / k, gy0 = cy - (H / 2) / k, gy1 = cy + (H / 2) / k;
    for (var gx = Math.ceil(gx0 / gridStep) * gridStep; gx <= gx1; gx += gridStep) {
      var sx = X(gx); if (sx < 4 || sx > W - 4) continue;
      out.push('<line x1="' + sx.toFixed(2) + '" y1="0" x2="' + sx.toFixed(2) + '" y2="' + H + '" stroke="#c9d6e0" stroke-width="0.15"/>');
      out.push('<text x="' + sx.toFixed(2) + '" y="' + (H - 1.2) + '" font-size="1.9" fill="#6a8091" text-anchor="middle">' + num(gx, 0) + '</text>');
    }
    for (var gy = Math.ceil(gy0 / gridStep) * gridStep; gy <= gy1; gy += gridStep) {
      var sy = Y(gy); if (sy < 4 || sy > H - 14) continue;
      out.push('<line x1="0" y1="' + sy.toFixed(2) + '" x2="' + W + '" y2="' + sy.toFixed(2) + '" stroke="#c9d6e0" stroke-width="0.15"/>');
      out.push('<text x="1.2" y="' + (sy - 0.6).toFixed(2) + '" font-size="1.9" fill="#6a8091">' + num(gy, 0) + '</text>');
    }
    // Bidang.
    data.parts.forEach(function (part) {
      var d = part.rings.map(function (r) { return r.points.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(2) + ' ' + Y(p.y).toFixed(2); }).join(' ') + ' Z'; }).join(' ');
      out.push('<path d="' + d + '" fill="rgba(255,0,140,.08)" fill-rule="evenodd" stroke="#d6006f" stroke-width="0.5" stroke-linejoin="round"/>');
    });
    var totalPts = data.count, showSides = totalPts <= 80, showNumbers = totalPts <= 120;
    data.parts.forEach(function (part) {
      part.rings.forEach(function (r) {
        if (showSides) r.sides.forEach(function (sd, i) {
          var p = r.points[i], q = r.points[(i + 1) % r.points.length], x1 = X(p.x), y1 = Y(p.y), x2 = X(q.x), y2 = Y(q.y), segLen = Math.hypot(x2 - x1, y2 - y1), text = num(sd.length, 2);
          if (segLen < text.length * 1.35 + 2) return;
          var ang = Math.atan2(y2 - y1, x2 - x1) / RAD; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
          var mx = (x1 + x2) / 2 + sd.nx * 2.4, my = (y1 + y2) / 2 - sd.ny * 2.4;
          out.push('<text x="' + mx.toFixed(2) + '" y="' + my.toFixed(2) + '" font-size="2.5" fill="#17354d" text-anchor="middle" dominant-baseline="middle" transform="rotate(' + ang.toFixed(1) + ' ' + mx.toFixed(2) + ' ' + my.toFixed(2) + ')" paint-order="stroke" stroke="#fff" stroke-width="0.6">' + text + '</text>');
        });
        r.points.forEach(function (p, i) {
          var x = X(p.x), y = Y(p.y);
          out.push('<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="' + (showNumbers ? 0.75 : 0.45) + '" fill="#fff" stroke="#d6006f" stroke-width="0.35"/>');
          if (!showNumbers) return;
          var prev = r.sides[(i - 1 + r.sides.length) % r.sides.length], next = r.sides[i], ox = prev.nx + next.nx, oy = prev.ny + next.ny, ol = Math.hypot(ox, oy) || 1;
          var lx = x + ox / ol * 3, ly = y - oy / ol * 3;
          out.push('<text x="' + lx.toFixed(2) + '" y="' + ly.toFixed(2) + '" font-size="2.7" font-weight="700" fill="#b0005c" text-anchor="middle" dominant-baseline="middle" paint-order="stroke" stroke="#fff" stroke-width="0.7">' + p.no + '</text>');
        });
      });
    });
    // Panah utara (utara grid).
    out.push('<g transform="translate(' + (W - 10) + ' 6)"><path d="M0 0 L3 9 L0 7 L-3 9 Z" fill="#17354d"/><text x="0" y="13" font-size="3" font-weight="700" text-anchor="middle" fill="#17354d">U</text></g>');
    // Skala batang.
    var barM = niceBelow(40 / k, [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000]), barW = barM * k, bx = 5, by = H - 9;
    out.push('<rect x="' + (bx - 1.5) + '" y="' + (by - 4.2) + '" width="' + (barW + 9) + '" height="9.5" fill="rgba(255,255,255,.92)"/>');
    out.push('<rect x="' + bx + '" y="' + by + '" width="' + (barW / 2).toFixed(2) + '" height="1.4" fill="#17354d"/><rect x="' + (bx + barW / 2).toFixed(2) + '" y="' + by + '" width="' + (barW / 2).toFixed(2) + '" height="1.4" fill="#fff" stroke="#17354d" stroke-width="0.25"/>');
    out.push('<text x="' + bx + '" y="' + (by - 1) + '" font-size="2.2" fill="#17354d">0</text><text x="' + (bx + barW).toFixed(2) + '" y="' + (by - 1) + '" font-size="2.2" fill="#17354d" text-anchor="middle">' + num(barM, 0) + ' m</text>');
    out.push('</svg>');
    return { svg: out.join(''), scale: scale };
  }

  /* ---------------- Tautan + QR ---------------- */
  function zig(n) { return n >= 0 ? 2 * n : -2 * n - 1; }
  function unzig(n) { return n % 2 ? -(n + 1) / 2 : n / 2; }
  function pushVar(bytes, n) { while (n >= 128) { bytes.push(n % 128 + 128); n = Math.floor(n / 128); } bytes.push(n); }
  function b64url(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64url(text) { var s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4)), out = []; for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); return out; }

  function encodePolygons(polys, prec) {
    var f = Math.pow(10, prec), bytes = [1, prec], px = 0, py = 0;
    pushVar(bytes, polys.length);
    polys.forEach(function (rings) {
      pushVar(bytes, rings.length);
      rings.forEach(function (ring) {
        pushVar(bytes, ring.length);
        ring.forEach(function (p) { var x = Math.round(p[0] * f), y = Math.round(p[1] * f); pushVar(bytes, zig(x - px)); pushVar(bytes, zig(y - py)); px = x; py = y; });
      });
    });
    return b64url(bytes);
  }
  function decodePolygons(text) {
    var bytes = unb64url(text), pos = 0;
    function read() { var n = 0, mul = 1, b; do { if (pos >= bytes.length) throw new Error('Kode bidang terpotong.'); b = bytes[pos++]; n += (b % 128) * mul; mul *= 128; } while (b >= 128 && mul < 1e16); return n; }
    if (read() !== 1) throw new Error('Versi kode bidang tidak dikenal.');
    var prec = read(); if (prec < 4 || prec > 8) throw new Error('Kode bidang tidak valid.');
    var f = Math.pow(10, prec), px = 0, py = 0, total = 0, polys = [], np = read();
    if (np < 1 || np > 500) throw new Error('Kode bidang tidak valid.');
    for (var i = 0; i < np; i++) {
      var nr = read(), rings = []; if (nr < 1 || nr > 500) throw new Error('Kode bidang tidak valid.');
      for (var j = 0; j < nr; j++) {
        var n = read(), ring = []; total += n; if (n < 3 || total > 50000) throw new Error('Kode bidang tidak valid.');
        for (var k = 0; k < n; k++) { px += unzig(read()); py += unzig(read()); var lon = px / f, lat = py / f; if (Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new Error('Koordinat di luar jangkauan.'); ring.push([lon, lat]); }
        ring.push(ring[0].slice()); rings.push(ring);
      }
      polys.push(rings);
    }
    return polys;
  }

  function baseUrl() {
    try { if (/^https?:$/.test(location.protocol) && !/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname)) return location.origin + location.pathname.replace(/index\.html$/i, ''); } catch (e) {}
    return PUBLIC_URL;
  }

  // Douglas–Peucker pada koordinat planar (meter).
  function simplifyRing(ring, tol, zone) {
    if (ring.length <= 4) return ring;
    var xy = ring.map(function (p) { return toUtm(p[1], p[0], zone); }), keep = new Array(ring.length), stack = [[0, ring.length - 1]];
    keep[0] = keep[ring.length - 1] = true;
    while (stack.length) {
      var s = stack.pop(), a = xy[s[0]], b = xy[s[1]], best = -1, idx = -1, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      for (var i = s[0] + 1; i < s[1]; i++) {
        var d = len ? Math.abs(dy * xy[i][0] - dx * xy[i][1] + b[0] * a[1] - b[1] * a[0]) / len : Math.hypot(xy[i][0] - a[0], xy[i][1] - a[1]);
        if (d > best) { best = d; idx = i; }
      }
      if (best > tol) { keep[idx] = true; stack.push([s[0], idx], [idx, s[1]]); }
    }
    var out = ring.filter(function (p, i) { return keep[i]; });
    return out.length >= 3 ? out : ring;
  }

  function linkFor(geometry, point) {
    var base = baseUrl(), polys = collectPolygons(geometry).map(function (p) { return p.map(openRing).filter(function (r) { return r.length >= 3; }); }).filter(function (p) { return p.length; });
    if (polys.length) {
      var zone = utmZone(polys[0][0][0][0]), tolerances = [0, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25];
      for (var t = 0; t < tolerances.length; t++) {
        var tol = tolerances[t], use = tol ? polys.map(function (p) { return p.map(function (r) { var c = r.concat([r[0]]); return openRing(simplifyRing(c, tol, zone)); }); }) : polys;
        for (var prec = 7; prec >= 6; prec--) {
          var url = base + '#bidang=' + encodePolygons(use, prec);
          if (url.length <= QR_MAX_URL) return { url: url, kind: 'bidang', simplified: tol, precision: prec };
        }
      }
    }
    var pt = point || (function () { var b = parcel(geometry); if (!b) return null; var s = [0, 0], n = 0; b.parts[0].rings[0].points.forEach(function (p) { s[0] += p.lat; s[1] += p.lon; n++; }); return { lat: s[0] / n, lng: s[1] / n }; })();
    if (!pt) return null;
    return { url: base + '#titik=' + pt.lat.toFixed(6) + ',' + pt.lng.toFixed(6), kind: 'titik', fallback: polys.length > 0 };
  }

  function qrSvg(text) {
    var maker = root.qrcode;
    if (typeof maker !== 'function') return '';
    try { var q = maker(0, text.length > 500 ? 'L' : 'M'); q.addData(text, 'Byte'); q.make(); return q.createSvgTag({ cellSize: 2, margin: 0, scalable: true }); } catch (e) { return ''; }
  }

  // Membaca #bidang= / #titik= dari alamat. Mengembalikan null bila tidak ada tautan.
  function readHash(hash) {
    hash = hash == null ? location.hash : hash;
    var m = /[#&]bidang=([A-Za-z0-9_-]+)/.exec(hash || '');
    if (m) {
      try {
        var polys = decodePolygons(m[1]);
        return { type: 'bidang', key: m[1], data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { Sumber: 'Tautan / QR Bale Ruang NTB' }, geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys } }] } };
      } catch (e) { return { type: 'error', key: m[1], error: 'Tautan bidang tidak dapat dibaca: ' + (e && e.message || 'format tidak dikenal') }; }
    }
    m = /[#&]titik=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(hash || '');
    if (m) {
      var lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { type: 'titik', key: m[1] + ',' + m[2], lat: lat, lng: lng };
    }
    return null;
  }

  /* ---------------- Fasilitas terdekat ----------------
   * Sumber utama: data Overture Maps Places untuk NTB yang disimpan di aplikasi (data/fasilitas/ntb-overture.json,
   * dibangun oleh tools/fasilitas-overture.py) sehingga tidak bergantung pada server luar.
   * Cadangan: OpenStreetMap lewat Overpass, untuk titik di luar cakupan data atau bila file gagal dimuat. */
  var GROUPS = [
    { id: 'edu', label: 'Pendidikan' }, { id: 'health', label: 'Kesehatan' }, { id: 'worship', label: 'Ibadah' },
    { id: 'market', label: 'Belanja & pasar' }, { id: 'gov', label: 'Pemerintahan' }
  ];
  var SCRIPT_BASE = (function () { try { var src = document.currentScript && document.currentScript.src; return src ? new URL('../', src).href : ''; } catch (e) { return ''; } })();
  var LOCAL_DATA_URL = 'data/fasilitas/ntb-overture.json?v=2026-11-18.0b';
  var SOURCE_TEXT = {
    overture: 'Sumber: Overture Maps Foundation (Places), disimpan di Bale Ruang NTB',
    osm: 'Sumber: © kontributor OpenStreetMap (ODbL), diambil saat dibuka'
  };
  function classify(t) {
    var a = t.amenity, name = t.name || '';
    if (a === 'school') return ['edu', /^(SDN?|MIN?|SD\s|UPT\s*SD)/i.test(name) ? 'SD/MI' : /^(SMPN?|MTSN?)\b/i.test(name) ? 'SMP/MTs' : /^(SMAN?|SMKN?|MAN?)\b/i.test(name) ? 'SMA/SMK/MA' : 'Sekolah'];
    if (a === 'kindergarten') return ['edu', 'TK/PAUD'];
    if (a === 'college' || a === 'university') return ['edu', 'Perguruan tinggi'];
    if (a === 'hospital' || t.healthcare === 'hospital') return ['health', 'Rumah sakit'];
    if (a === 'clinic' || a === 'doctors' || /^(clinic|centre|doctor)$/.test(t.healthcare || '')) return ['health', /puskesmas/i.test(name) ? 'Puskesmas/pustu' : a === 'doctors' || t.healthcare === 'doctor' ? 'Praktik dokter' : 'Klinik'];
    if (a === 'place_of_worship') return ['worship', { muslim: 'Masjid / musala', hindu: 'Pura', christian: 'Gereja', buddhist: 'Vihara' }[t.religion] || 'Tempat ibadah'];
    if (a === 'marketplace') return ['market', 'Pasar'];
    if (t.shop === 'supermarket') return ['market', 'Swalayan'];
    if (t.shop === 'convenience') return ['market', 'Minimarket'];
    if (a === 'townhall') return ['gov', /desa|kelurahan/i.test(name) ? 'Kantor desa/kelurahan' : 'Kantor pemerintah'];
    if (a === 'police') return ['gov', 'Kantor polisi'];
    if (t.office === 'government') return ['gov', 'Kantor pemerintah'];
    return null;
  }
  var facilityCache = Object.create(null), localData = null;
  function facilityKey(lat, lng) { return lat.toFixed(3) + ',' + lng.toFixed(3); }
  function overpassQuery(lat, lng) {
    var a = '(around:' + FACILITY_RADIUS + ',' + lat.toFixed(5) + ',' + lng.toFixed(5) + ')';
    return '[out:json][timeout:25];(' +
      'nwr' + a + '["amenity"~"^(school|kindergarten|college|university|hospital|clinic|doctors|place_of_worship|marketplace|townhall|police)$"]["name"];' +
      'nwr' + a + '["healthcare"~"^(hospital|clinic|centre|doctor)$"]["name"];' +
      'nwr' + a + '["shop"~"^(supermarket|convenience)$"]["name"];' +
      'nwr' + a + '["office"="government"]["name"];' +
      ');out center tags;';
  }
  function fetchWithTimeout(url, init, ms) {
    if (typeof AbortController === 'undefined') return fetch(url, init);
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, ms);
    init.signal = ctl.signal;
    return fetch(url, init).then(function (r) { clearTimeout(timer); return r; }, function (e) { clearTimeout(timer); throw e; });
  }
  function loadLocalData() {
    if (!localData) {
      localData = fetchWithTimeout(SCRIPT_BASE + LOCAL_DATA_URL, {}, 20000)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      localData.catch(function () { localData = null; });
    }
    return localData;
  }
  function fromLocal(d, lat, lng) {
    var bb = d.bbox || [];
    if (!(lng >= bb[0] && lat >= bb[1] && lng <= bb[2] && lat <= bb[3])) return null;
    // Kotak kasar radius + 5 km agar bidang besar (jarak diukur dari tepi) tetap mendapat kandidat.
    var dLat = (FACILITY_RADIUS + 5000) / 110574, dLng = dLat / Math.max(0.2, Math.cos(lat * RAD)), out = [];
    (d.items || []).forEach(function (it) {
      if (Math.abs(it[1] - lat) > dLat || Math.abs(it[0] - lng) > dLng) return;
      out.push({ group: d.groups[it[2]], type: d.types[it[3]], name: it[4], lat: it[1], lng: it[0] });
    });
    out.source = 'overture';
    return out;
  }
  function fetchOverpass(lat, lng) {
    var body = 'data=' + encodeURIComponent(overpassQuery(lat, lng)), i = 0;
    function attempt() {
      return fetchWithTimeout(OVERPASS[i], { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body }, 20000)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .catch(function (e) { if (++i < OVERPASS.length) return attempt(); throw e; });
    }
    return attempt().then(function (json) {
      var seen = Object.create(null);
      var list = (json.elements || []).map(function (el) {
        var t = el.tags || {}, c = classify(t), la = el.lat != null ? el.lat : el.center && el.center.lat, lo = el.lon != null ? el.lon : el.center && el.center.lon;
        if (!c || la == null || lo == null || !t.name) return null;
        var id = c[0] + '|' + t.name.toLowerCase(); if (seen[id]) return null; seen[id] = 1;
        return { group: c[0], type: c[1], name: t.name, lat: la, lng: lo };
      }).filter(Boolean);
      list.source = 'osm';
      return list;
    });
  }
  function fetchFacilities(lat, lng) {
    var key = facilityKey(lat, lng);
    if (facilityCache[key]) return facilityCache[key];
    var promise = loadLocalData().then(function (d) { return fromLocal(d, lat, lng); }, function () { return null; })
      .then(function (list) { return list || fetchOverpass(lat, lng); });
    facilityCache[key] = promise;
    promise.then(function (list) { promise.value = list; }, function () { delete facilityCache[key]; });
    return promise;
  }

  // Jarak (m) dari titik fasilitas ke bidang: 0 bila di dalam, selain itu ke sisi terdekat. Proyeksi lokal cukup untuk radius beberapa km.
  function ringsOf(geometry) {
    return collectPolygons(geometry).map(function (poly) { return poly.map(openRing).filter(function (r) { return r.length >= 3; }); }).filter(function (p) { return p.length; });
  }
  function distanceToRings(rings, lat, lng) {
    var ky = 110574, kx = 111320 * Math.cos(lat * RAD), best = Infinity;
    for (var p = 0; p < rings.length; p++) {
      var xy = rings[p].map(function (r) { return r.map(function (c) { return [(c[0] - lng) * kx, (c[1] - lat) * ky]; }); });
      if (inPart([0, 0], xy)) return 0;
      xy.forEach(function (ring) {
        for (var i = 0, n = ring.length; i < n; i++) {
          var a = ring[i], b = ring[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
          var t = len ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / len)) : 0, x = a[0] + t * dx, y = a[1] + t * dy;
          best = Math.min(best, Math.sqrt(x * x + y * y));
        }
      });
    }
    return best;
  }
  // list: hasil fetchFacilities; ref: { lat, lng, rings? } -> [{ group, label, items:[{ f, d }] }]
  function nearestFacilities(list, ref, perGroup) {
    return GROUPS.map(function (g) {
      var items = list.filter(function (f) { return f.group === g.id; }).map(function (f) {
        return { f: f, d: ref.rings && ref.rings.length ? distanceToRings(ref.rings, f.lat, f.lng) : inverse(ref.lat, ref.lng, f.lat, f.lng).dist };
      }).filter(function (it) { return it.d <= FACILITY_RADIUS; }).sort(function (a, b) { return a.d - b.d; });
      var seen = Object.create(null); // nama sama (titik ganda di sumber data) cukup ditampilkan sekali, yang terdekat
      items = items.filter(function (it) { var k = it.f.name.toLowerCase().replace(/\s+/g, ' ').trim(); if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, perGroup || 2);
      return { id: g.id, label: g.label, items: items };
    });
  }
  function facilitiesTable(list, lat, lng, rings) {
    var edge = rings && rings.length;
    var rows = nearestFacilities(list, { lat: lat, lng: lng, rings: rings }, 2).map(function (g) {
      var items = g.items;
      if (!items.length) return '<tr><td class="l"><b>' + esc(g.label) + '</b></td><td colspan="2" class="mut">Tidak ditemukan dalam radius ' + (FACILITY_RADIUS / 1000) + ' km</td></tr>';
      return items.map(function (it, i) {
        return '<tr>' + (i ? '' : '<td class="l" rowspan="' + items.length + '"><b>' + esc(g.label) + '</b></td>') + '<td>' + esc(it.f.name) + '<small>' + esc(it.f.type) + '</small></td><td class="r">' + (it.d < 1 ? 'di dalam bidang' : fmtDistance(it.d)) + '</td></tr>';
      }).join('');
    }).join('');
    return '<table class="rt br-fac-table"><colgroup><col style="width:22%"><col><col style="width:14%"></colgroup><thead><tr><th>Kategori</th><th>Nama · jenis</th><th class="r">Jarak</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="br-src">Tempat terdekat dalam radius ' + (FACILITY_RADIUS / 1000) + ' km, jarak garis lurus dari ' + (edge ? 'tepi bidang' : 'titik acuan') + '. ' + (SOURCE_TEXT[list.source] || SOURCE_TEXT.osm) + '; bisa belum lengkap atau sudah berubah.</p>';
  }
  function facilitiesFailed() { return '<p class="br-src">Data fasilitas tidak dapat dimuat saat laporan dibuat. Buat ulang laporan untuk mencoba lagi.</p>'; }

  // Dipanggil di aplikasi saat pengaturan cetak dibuka, supaya data sudah siap ketika laporan dibuat.
  function prefetch(lat, lng) { if (isFinite(lat) && isFinite(lng)) fetchFacilities(lat, lng).catch(function () {}); }

  /* ---------------- Bagian laporan ---------------- */
  var CSS = '.br-detail{padding:0 10mm;break-before:page;page-break-before:always}' +
    '.br-detail .sec{margin:4mm 0 2mm}' +
    '.br-sketch-wrap{border:1px solid #c5d4df;border-radius:6px;padding:3mm;break-inside:avoid}' +
    '.br-sketch{display:block;width:100%;height:auto}' +
    '.br-cap{margin:1.5mm 0 0;color:#5a7183;font-size:7.5px}' +
    '.br-row{display:grid;grid-template-columns:minmax(0,1fr) 50mm;gap:4mm;margin-top:3mm;break-inside:avoid}' +
    '.br-kv{border:1px solid #c5d4df;border-radius:6px;padding:6px 9px}' +
    '.br-kv table{width:100%;border-collapse:collapse;font-size:8.5px}.br-kv th{text-align:left;font-weight:500;color:#5a7183;padding:2px 6px 2px 0;width:42%}.br-kv td{font-weight:700;padding:2px 0}' +
    '.br-qr{border:1px solid #c5d4df;border-radius:6px;padding:6px;text-align:center;font-size:7px;color:#5a7183;line-height:1.35}' +
    '.br-qr svg{display:block;width:40mm;height:40mm;margin:0 auto 4px}.br-qr b{display:block;color:#084779;font-size:8px;margin-bottom:2px}.br-qr a{color:#0b5c99;word-break:break-all}' +
    '.br-pts td,.br-pts th{padding:3px 5px!important;font-size:7.8px!important}.br-pts td{font-variant-numeric:tabular-nums}.br-pts .r,.br-fac-table .r{text-align:right}' +
    '.br-pts .grp td{padding:3px 5px!important}' +
    '.br-fac-table td small{display:block;color:#5a7183;font-size:7.3px}.br-fac-table .mut{color:#7a8e9d}' +
    '.br-src{margin:1.5mm 0 0;color:#5a7183;font-size:7.3px;line-height:1.4}' +
    '.br-note{margin-top:3mm;padding:6px 9px;border-left:4px solid #e0a800;background:#fffaf0;color:#5c4300;font-size:8px;line-height:1.45;border-radius:5px}';

  function hemi(v, pos, neg, dec) { return Math.abs(v).toFixed(dec) + '° ' + (v < 0 ? neg : pos); }

  function pointsTable(data) {
    var rows = [], shown = 0, partCount = data.parts.length;
    data.parts.forEach(function (part, pi) {
      part.rings.forEach(function (r, ri) {
        if (shown >= TABLE_MAX_ROWS) return;
        if (partCount > 1 || ri > 0) rows.push('<tr class="grp"><td colspan="8">' + (partCount > 1 ? 'Bagian ' + (pi + 1) : 'Bidang') + (ri > 0 ? ' · lubang ' + ri : '') + ' — ' + r.points.length + ' titik, panjang batas ' + fmtLength(r.length) + '</td></tr>');
        r.points.forEach(function (p, i) {
          if (shown >= TABLE_MAX_ROWS) return; shown++;
          var sd = r.sides[i];
          rows.push('<tr><td><b>' + p.no + '</b></td><td>' + hemi(p.lat, 'LU', 'LS', 7) + '</td><td>' + hemi(p.lon, 'BT', 'BB', 7) + '</td><td class="r">' + num(p.x, 2) + '</td><td class="r">' + num(p.y, 2) + '</td><td>' + sd.from + '–' + sd.to + '</td><td class="r">' + num(sd.length, 2) + '</td><td>' + sd.facing + ' · ' + Math.round(sd.azimuth) % 360 + '°</td></tr>');
        });
      });
    });
    var more = data.count > shown ? '<p class="br-src">Tabel menampilkan ' + shown + ' dari ' + data.count + ' titik. Unduh SHP/KML bidang untuk daftar lengkap.</p>' : '';
    return '<table class="rt br-pts"><colgroup><col style="width:6%"><col style="width:15%"><col style="width:16%"><col style="width:12%"><col style="width:13%"><col style="width:8%"><col style="width:10%"><col></colgroup>' +
      '<thead><tr><th>Titik</th><th>Lintang</th><th>Bujur</th><th class="r">X UTM (m)</th><th class="r">Y UTM (m)</th><th>Sisi</th><th class="r">Panjang (m)</th><th>Menghadap · azimut</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' + more +
      '<p class="br-src">Titik dinomori searah jarum jam mulai dari titik paling barat laut. Panjang sisi dan azimut (dari utara sejati) dihitung pada elipsoid WGS84; X/Y pada UTM zona ' + data.zone + (data.south ? 'S' : 'N') + '. "Menghadap" adalah arah sisi tersebut dilihat dari dalam bidang.</p>';
  }

  /* opts: { geometry, pointShape, center:{lat,lng}, head, ident, areaInfo:{computed, attribute, attributeLabel}, sourceLabel } */
  function reportSection(opts) {
    var center = opts.center, link = linkFor(opts.geometry, opts.pointShape ? center : null), qr = link ? qrSvg(link.url) : '';
    var data = opts.pointShape ? null : parcel(opts.geometry), html = [], key = center ? facilityKey(center.lat, center.lng) : '';
    html.push('<section class="br-detail">' + (opts.head || '') + (opts.ident || ''));
    if (data) {
      var sk = sketchSvg(data);
      html.push('<h2 class="sec">Sketsa Batas Bidang</h2><div class="br-sketch-wrap">' + sk.svg + '<p class="br-cap">Skala 1:' + num(sk.scale, 0) + ' pada kertas A4 (cetak 100%) · UTM zona ' + data.zone + (data.south ? 'S' : 'N') + ' (WGS84) · utara grid · angka merah = nomor titik, angka hitam = panjang sisi (m)</p></div>');
    }
    var kv = [];
    if (data) {
      kv.push(['Jumlah titik batas', num(data.count, 0)]);
      kv.push(['Keliling', fmtLength(data.perimeter)]);
      if (opts.areaInfo && opts.areaInfo.computed) kv.push(['Luas hitung (geometri)', num(Math.round(opts.areaInfo.computed), 0) + ' m²']);
      if (opts.areaInfo && opts.areaInfo.attribute) kv.push(['Luas pada atribut', num(Math.round(opts.areaInfo.attribute), 0) + ' m²' + (opts.areaInfo.computed ? ' (selisih ' + num(Math.abs(opts.areaInfo.attribute - opts.areaInfo.computed), 0) + ' m²)' : '')]);
      if (data.parts.length > 1) kv.push(['Jumlah bagian', num(data.parts.length, 0)]);
    }
    if (center) kv.push([opts.pointShape ? 'Koordinat titik' : 'Titik acuan', center.lat.toFixed(6) + ', ' + center.lng.toFixed(6)]);
    if (opts.sourceLabel) kv.push(['Sumber geometri', opts.sourceLabel]);
    var qrBox = link ? '<div class="br-qr">' + qr + '<b>Buka di Bale Ruang NTB</b>' + (link.kind === 'bidang' ? 'Pindai untuk menampilkan bidang ini di peta dan menganalisisnya kembali.' + (link.simplified ? ' Bentuk disederhanakan ±' + num(link.simplified, 2) + ' m agar muat di QR.' : '') : link.fallback ? 'Bidang terlalu rinci untuk QR; kode ini membuka titik acuannya.' : 'Pindai untuk membuka titik ini di peta dan menganalisisnya kembali.') + '<br><a href="' + esc(link.url) + '">' + esc(link.url.length > 70 ? link.url.slice(0, 64) + '…' : link.url) + '</a></div>' : '';
    html.push('<div class="br-row"><div class="br-kv"><table>' + kv.map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table></div>' + qrBox + '</div>');
    if (data) html.push('<h2 class="sec">Titik Batas Bidang</h2>' + pointsTable(data));
    if (center) {
      var cached = facilityCache[key], ready = cached && cached.value, rings = opts.pointShape ? null : ringsOf(opts.geometry);
      var ringPts = (rings || []).reduce(function (n, p) { return n + p.reduce(function (m, r) { return m + r.length; }, 0); }, 0);
      if (ringPts > 4000) rings = null; // bidang sangat rinci: ukur dari titik acuan agar laporan tetap ringan
      var ringAttr = rings && !ready ? ' data-rings="' + esc(JSON.stringify(rings.map(function (p) { return p.map(function (r) { return r.map(function (c) { return [+c[0].toFixed(7), +c[1].toFixed(7)]; }); }); }))) + '"' : '';
      html.push('<h2 class="sec">Fasilitas Terdekat</h2><div class="br-fac"' + (ready ? '' : ' data-pending="1" data-lat="' + center.lat + '" data-lng="' + center.lng + '"' + ringAttr) + '>' + (ready ? facilitiesTable(cached.value, center.lat, center.lng, rings) : '<p class="br-src">Memuat data fasilitas…</p>') + '</div>');
    }
    html.push('<div class="br-note"><b>Catatan:</b> Sketsa dan titik batas dihitung dari geometri yang diunggah/digambar di Bale Ruang NTB, bukan dari gambar ukur atau sertifikat resmi. Untuk kepastian batas, rujuk dokumen ATR/BPN.</div></section>');
    return { html: html.join(''), css: CSS, link: link, perimeter: data ? data.perimeter : 0 };
  }

  // Dijalankan di jendela laporan: melengkapi fasilitas yang belum siap, lalu memberi tahu proses cetak.
  function runReport() {
    var boxes = [].slice.call(document.querySelectorAll('.br-fac[data-pending]'));
    if (!boxes.length) return Promise.resolve();
    return Promise.all(boxes.map(function (box) {
      var lat = Number(box.getAttribute('data-lat')), lng = Number(box.getAttribute('data-lng')), rings = null;
      try { rings = JSON.parse(box.getAttribute('data-rings') || 'null'); } catch (e) {}
      var timeout = new Promise(function (resolve, reject) { setTimeout(function () { reject(new Error('timeout')); }, 15000); });
      return Promise.race([fetchFacilities(lat, lng), timeout]).then(function (list) { box.innerHTML = facilitiesTable(list, lat, lng, rings); }, function () { box.innerHTML = facilitiesFailed(); })
        .then(function () { box.removeAttribute('data-pending'); });
    }));
  }

  root.BidangReport = {
    parcel: parcel, perimeter: perimeter, sketchSvg: sketchSvg, linkFor: linkFor, readHash: readHash, qrSvg: qrSvg,
    encodePolygons: encodePolygons, decodePolygons: decodePolygons, fetchFacilities: fetchFacilities, nearestFacilities: nearestFacilities, ringsOf: ringsOf, facilityRadius: FACILITY_RADIUS, facilitySource: SOURCE_TEXT, prefetch: prefetch,
    reportSection: reportSection, runReport: runReport, inverse: inverse, toUtm: toUtm
  };
})(window);
