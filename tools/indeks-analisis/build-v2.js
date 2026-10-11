// Bale Ruang NTB — penataan ulang paket analisis (v2) + indeks titik (pidx).
// Fitur & koordinat TIDAK diubah: setiap fitur ditulis ulang apa adanya (JSON.parse -> JSON.stringify, nilai identik).
// Perubahan hanya pada pengelompokan berkas:
//   packs/<sx>_m<sy>.js.gz : fitur kecil, dikelompokkan per sub-grid 0.02° (berdasarkan sudut kiri-bawah bbox)
//   packs/g<n>.js.gz       : setiap fitur besar (>100 KB) dalam berkas sendiri
//   cells/<cell>.js        : daftar paket yang fiturnya bersinggungan (bbox) dengan sel 0.1°
//   pidx/<cell>.json.gz    : indeks titik (bbox fitur kecil + potongan uji fitur besar)
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const SRC = process.argv[2], OUT = process.argv[3];
const ONLY = process.argv[4] && process.argv[4] !== 'all' ? process.argv[4].split(',') : null;
const LEGACY = process.argv[5] ? JSON.parse(fs.readFileSync(process.argv[5], 'utf8')) : []; // [{key, folder, file, source}]
const T = 100000, SUB = 5, EPS = 1e-9, SPLIT = 150000;

const idxSrc = fs.readFileSync(path.join(SRC, 'index.js'), 'utf8');
const index = JSON.parse(idxSrc.slice(idxSrc.indexOf('=') + 1).trim().replace(/;$/, ''));

function readPack(file) { const raw = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'); return JSON.parse(raw.slice(raw.indexOf('={"type"') + 1).trim().replace(/;$/, '')); }
function bboxOf(c, b) { if (typeof c[0] === 'number') { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; return b; } for (const x of c) bboxOf(x, b); return b; }
function clipRing(ring, w) {
  let pts = ring.slice(0, ring.length - 1); if (pts.length < 3) return null;
  const E = [
    [p => p[0] >= w[0], (a, b) => { const t = (w[0] - a[0]) / (b[0] - a[0]); return [w[0], a[1] + t * (b[1] - a[1])]; }],
    [p => p[0] <= w[2], (a, b) => { const t = (w[2] - a[0]) / (b[0] - a[0]); return [w[2], a[1] + t * (b[1] - a[1])]; }],
    [p => p[1] >= w[1], (a, b) => { const t = (w[1] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), w[1]]; }],
    [p => p[1] <= w[3], (a, b) => { const t = (w[3] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), w[3]]; }]];
  for (const [inside, cut] of E) {
    if (!pts.length) return null; const out = [];
    for (let i = 0; i < pts.length; i++) { const cur = pts[i], prev = pts[(i + pts.length - 1) % pts.length], ci = inside(cur), pi = inside(prev); if (ci) { if (!pi) out.push(cut(prev, cur)); out.push(cur); } else if (pi) out.push(cut(prev, cur)); }
    pts = out;
  }
  if (pts.length < 3) return null; pts = pts.map(p => [p[0], p[1]]); pts.push(pts[0]); return pts;
}
function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return Math.abs(a / 2); }
function ringBox(r) { return bboxOf(r, [Infinity, Infinity, -Infinity, -Infinity]); }
function overl(a, b) { return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]; }
function clipPolys(polys, w) {
  const out = [], wa = (w[2] - w[0]) * (w[3] - w[1]);
  for (const poly of polys) {
    if (!overl(poly.boxes[0], w)) continue;
    const outer = clipRing(poly.rings[0], w); if (!outer) continue;
    const holes = []; for (let h = 1; h < poly.rings.length; h++) { if (!overl(poly.boxes[h], w)) continue; const c = clipRing(poly.rings[h], w); if (c) holes.push(c); }
    if (!holes.length && Math.abs(ringArea(outer) - wa) <= wa * 1e-12) return 1;
    out.push([outer].concat(holes));
  }
  return out.length ? out : null;
}
function toPolys(g) { const l = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; return l.filter(p => p && p.length).map(rings => ({ rings, boxes: rings.map(ringBox) })); }
const gz = s => zlib.gzipSync(Buffer.from(s), { level: 9 });
const cellFile = c => c.replace(':', '_m');

function buildLayer(key, folder, G, features, catalogCells) {
  const SG = G / SUB, outDir = path.join(OUT, folder);
  fs.rmSync(outDir, { recursive: true, force: true });
  ['packs', 'cells', 'pidx'].forEach(d => fs.mkdirSync(path.join(outDir, d), { recursive: true }));
  // 1) kelompokkan fitur
  const packs = new Map(); let giantN = 0;
  const items = [];
  for (const f of features) {
    if (!f.geometry || !f.geometry.coordinates) continue;
    const b = bboxOf(f.geometry.coordinates, [Infinity, Infinity, -Infinity, -Infinity]); if (!isFinite(b[0])) continue;
    const json = JSON.stringify(f), big = json.length > T && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
    const pack = big ? 'g' + (giantN++) : Math.floor(b[0] / SG) + ':' + Math.floor(b[1] / SG);
    if (!packs.has(pack)) packs.set(pack, []);
    const n = packs.get(pack).length; packs.get(pack).push(json);
    items.push({ f, b, big, pack, n });
  }
  // sel katalog: pakai daftar lama bila ada, selain itu dari bbox fitur
  const cells = catalogCells ? new Set(Object.keys(catalogCells)) : new Set();
  if (!catalogCells) for (const it of items) for (let x = Math.floor(it.b[0] / G); x <= Math.floor(it.b[2] / G); x++) for (let y = Math.floor(it.b[1] / G); y <= Math.floor(it.b[3] / G); y++) cells.add(x + ':' + y);
  // 2) tulis paket
  let packBytes = 0;
  for (const [pack, list] of packs) {
    const buf = gz('window.__LONTAR_ANALYSIS_CHUNKS__=window.__LONTAR_ANALYSIS_CHUNKS__||{};window.__LONTAR_ANALYSIS_CHUNKS__[' + JSON.stringify(key + '-pack|' + pack) + ']={"type":"FeatureCollection","features":[' + list.join(',') + ']};');
    fs.writeFileSync(path.join(outDir, 'packs', cellFile(pack) + '.js.gz'), buf); packBytes += buf.length;
  }
  // 3) refs per sel + pidx
  const refs = Object.create(null), pidx = Object.create(null);
  const P = c => pidx[c] || (pidx[c] = { p: Object.create(null), g: [] });
  for (const it of items) {
    const x0 = Math.floor(it.b[0] / G), x1 = Math.floor(it.b[2] / G), y0 = Math.floor(it.b[1] / G), y1 = Math.floor(it.b[3] / G);
    const polys = it.big ? toPolys(it.f.geometry) : null;
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const c = x + ':' + y; if (!cells.has(c)) continue;
      (refs[c] || (refs[c] = new Set())).add(it.pack);
      if (!it.big) { const e = P(c); (e.p[it.pack] || (e.p[it.pack] = [])).push([it.n, it.b[0], it.b[1], it.b[2], it.b[3]]); continue; }
      const cellPiece = clipPolys(polys, [x * G - EPS, y * G - EPS, (x + 1) * G + EPS, (y + 1) * G + EPS]); if (!cellPiece) continue;
      const cellPolys = cellPiece === 1 ? null : cellPiece.map(rings => ({ rings, boxes: rings.map(ringBox) }));
      const pieces = {}; let any = false;
      for (let sx = Math.max(x * SUB, Math.floor(it.b[0] / SG)); sx <= Math.min(x * SUB + SUB - 1, Math.floor(it.b[2] / SG)); sx++)
        for (let sy = Math.max(y * SUB, Math.floor(it.b[1] / SG)); sy <= Math.min(y * SUB + SUB - 1, Math.floor(it.b[3] / SG)); sy++) {
          const piece = cellPiece === 1 ? 1 : clipPolys(cellPolys, [sx * SG - EPS, sy * SG - EPS, (sx + 1) * SG + EPS, (sy + 1) * SG + EPS]);
          if (piece) { pieces[sx + ':' + sy] = piece; any = true; }
        }
      if (any) P(c).g.push({ id: it.f.id, k: it.pack, n: it.n, p: it.f.properties || {}, x: pieces });
    }
  }
  const catalogOut = Object.create(null); let pidxBytes = 0, pidxFiles = 0, maxPidx = 0;
  for (const c of [...cells].sort()) {
    const list = refs[c] ? [...refs[c]].sort() : [];
    catalogOut[c] = folder + '/cells/' + cellFile(c) + '.js';
    fs.writeFileSync(path.join(outDir, 'cells', cellFile(c) + '.js'), 'window.__LONTAR_ANALYSIS_REFS__=window.__LONTAR_ANALYSIS_REFS__||{};window.__LONTAR_ANALYSIS_REFS__[' + JSON.stringify(key + '|' + c) + ']=' + JSON.stringify(list) + ';');
    const e = pidx[c] || { p: {}, g: [] };
    const piecesSize = e.g.reduce((t, g) => t + JSON.stringify(g.x).length, 0);
    if (piecesSize > SPLIT) {
      const subs = Object.create(null);
      e.g.forEach((g, gi) => { for (const [sk, piece] of Object.entries(g.x)) { if (piece === 1) continue; (subs[sk] || (subs[sk] = {}))[gi] = piece; g.x[sk] = 2; } });
      fs.mkdirSync(path.join(outDir, 'pidx', cellFile(c)), { recursive: true });
      for (const [sk, obj] of Object.entries(subs)) { const buf = gz(JSON.stringify(obj)); fs.writeFileSync(path.join(outDir, 'pidx', cellFile(c), sk.replace(/-/g, 'm').replace(':', '_') + '.json.gz'), buf); pidxBytes += buf.length; pidxFiles++; maxPidx = Math.max(maxPidx, buf.length); }
    }
    const buf = gz(JSON.stringify({ v: 2, sub: SUB, p: e.p, g: e.g })); fs.writeFileSync(path.join(outDir, 'pidx', cellFile(c) + '.json.gz'), buf); pidxBytes += buf.length; pidxFiles++; maxPidx = Math.max(maxPidx, buf.length);
  }
  return { catalogCells: catalogOut, stats: { key, folder, features: items.length, giants: giantN, packs: packs.size, packMB: +(packBytes / 1e6).toFixed(1), pidxFiles, pidxMB: +(pidxBytes / 1e6).toFixed(1), maxPidxKB: Math.round(maxPidx / 1024) } };
}

const newIndex = JSON.parse(JSON.stringify(index));
for (const [key, cat] of Object.entries(index)) {
  if (!cat.folder || (ONLY && !ONLY.includes(key))) continue;
  const packDir = path.join(SRC, cat.folder, 'packs'); if (!fs.existsSync(packDir)) continue;
  const features = [];
  for (const fn of fs.readdirSync(packDir).sort()) features.push(...readPack(path.join(packDir, fn)).features);
  const r = buildLayer(key, cat.folder, cat.grid, features, cat.cells);
  newIndex[key].cells = r.catalogCells; newIndex[key].layout = 'v2-fine-packs+pidx';
  console.log(JSON.stringify(r.stats));
}
for (const L of LEGACY) {
  if (ONLY && !ONLY.includes(L.key)) continue;
  const raw = fs.readFileSync(L.file, 'utf8'); const fc = JSON.parse(raw.slice(raw.indexOf('{')).trim().replace(/;\s*$/, ''));
  const r = buildLayer(L.key, L.folder, 0.1, fc.features, null);
  newIndex[L.key] = { grid: 0.1, cells: r.catalogCells, features: r.stats.features, source: L.source, sourceCrs: 'EPSG:4326 / WGS 84', folder: L.folder, geometryPolicy: 'full-source-vertices-no-simplify-no-round-no-clip', layout: 'v2-fine-packs+pidx', pointIndexOnly: true };
  console.log(JSON.stringify(r.stats));
}
fs.writeFileSync(path.join(OUT, 'index.js'), 'window.__LONTAR_ANALYSIS_INDEX__=' + JSON.stringify(newIndex) + ';');
