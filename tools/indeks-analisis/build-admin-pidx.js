'use strict';
// Indeks titik batas desa: desa kecil -> [id,bbox]; desa besar -> potongan uji per sub-grid 0.02° + atribut.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const SRC = process.argv[2], OUT = process.argv[3], T = +(process.argv[4] || 200000);
const G = 0.1, SUB = 5, SG = G / SUB, EPS = 1e-9, SPLIT = 150000;
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


const idx = (() => { const s = fs.readFileSync(path.join(SRC, 'index.js'), 'utf8'); const a = s.indexOf('=') + 1; return JSON.parse(s.slice(a, s.indexOf('];window.') + 1)); })();
const files = Object.create(null); const F = c => files[c] || (files[c] = { s: [], g: [] });
let nBig = 0;
for (const entry of idx) {
  const raw = fs.readFileSync(path.join(SRC, entry.id + '.js'), 'utf8');
  const f = JSON.parse(raw.slice(raw.indexOf(']=') + 2).trim().replace(/;$/, ''));
  const b = entry.bbox, size = raw.length, big = size > T && f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
  const polys = big ? toPolys(f.geometry) : null; if (big) nBig++;
  for (let x = Math.floor(b[0] / G); x <= Math.floor(b[2] / G); x++) for (let y = Math.floor(b[1] / G); y <= Math.floor(b[3] / G); y++) {
    const c = x + ':' + y;
    if (!big) { F(c).s.push([entry.id, b[0], b[1], b[2], b[3]]); continue; }
    const cellPiece = clipPolys(polys, [x * G - EPS, y * G - EPS, (x + 1) * G + EPS, (y + 1) * G + EPS]); if (!cellPiece) continue;
    const cellPolys = cellPiece === 1 ? null : cellPiece.map(rings => ({ rings, boxes: rings.map(ringBox) }));
    const pieces = {}; let any = false;
    for (let sx = Math.max(x * SUB, Math.floor(b[0] / SG)); sx <= Math.min(x * SUB + SUB - 1, Math.floor(b[2] / SG)); sx++)
      for (let sy = Math.max(y * SUB, Math.floor(b[1] / SG)); sy <= Math.min(y * SUB + SUB - 1, Math.floor(b[3] / SG)); sy++) {
        const piece = cellPiece === 1 ? 1 : clipPolys(cellPolys, [sx * SG - EPS, sy * SG - EPS, (sx + 1) * SG + EPS, (sy + 1) * SG + EPS]);
        if (piece) { pieces[sx + ':' + sy] = piece; any = true; }
      }
    if (any) F(c).g.push({ id: entry.id, fid: f.id, p: f.properties || {}, x: pieces });
  }
}
const outDir = path.join(OUT, 'pidx'); fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
let bytes = 0, n = 0, max = 0;
for (const [c, e] of Object.entries(files)) {
  const name = c.replace(':', '_m');
  if (e.g.reduce((t, g) => t + JSON.stringify(g.x).length, 0) > SPLIT) {
    const subs = Object.create(null);
    e.g.forEach((g, gi) => { for (const [sk, piece] of Object.entries(g.x)) { if (piece === 1) continue; (subs[sk] || (subs[sk] = {}))[gi] = piece; g.x[sk] = 2; } });
    fs.mkdirSync(path.join(outDir, name), { recursive: true });
    for (const [sk, obj] of Object.entries(subs)) { const buf = gz(JSON.stringify(obj)); fs.writeFileSync(path.join(outDir, name, sk.replace(/-/g, 'm').replace(':', '_') + '.json.gz'), buf); bytes += buf.length; n++; max = Math.max(max, buf.length); }
  }
  const buf = gz(JSON.stringify({ v: 1, sub: SUB, s: e.s, g: e.g })); fs.writeFileSync(path.join(outDir, name + '.json.gz'), buf); bytes += buf.length; n++; max = Math.max(max, buf.length);
}
console.log(JSON.stringify({ T, villagesBig: nBig, cells: Object.keys(files).length, files: n, MB: +(bytes / 1e6).toFixed(1), maxKB: Math.round(max / 1024) }));
