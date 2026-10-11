'use strict';
// Verifikasi v2: (1) lossless, (2) uji titik, (3) kandidat bbox (tampilan/cetak/poligon)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const OLD = process.argv[2], NEW = process.argv[3], N = +(process.argv[4] || 3000);
const LEGACY = JSON.parse(fs.readFileSync(process.argv[5], 'utf8'));
const ONLY = process.argv[6] ? process.argv[6].split(',') : null;
const load = f => { const s = fs.readFileSync(f, 'utf8'); return JSON.parse(s.slice(s.indexOf('=') + 1).trim().replace(/;$/, '')); };
const oldIndex = load(path.join(OLD, 'index.js')), newIndex = load(path.join(NEW, 'index.js'));
function inRing(x,y,ring){var inside=false;for(var i=0,j=ring.length-1;i<ring.length;j=i++){var xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside}return inside}
function inPolygon(x,y,rings){if(!rings||!rings.length||!inRing(x,y,rings[0]))return false;for(var i=1;i<rings.length;i++)if(inRing(x,y,rings[i]))return false;return true}
function geometryContains(g,x,y){if(!g)return false;if(g.type==='Polygon')return inPolygon(x,y,g.coordinates);if(g.type==='MultiPolygon')return g.coordinates.some(function(p){return inPolygon(x,y,p)});if(g.type==='GeometryCollection')return (g.geometries||[]).some(function(a){return geometryContains(a,x,y)});return false}
function readPack(file) { const raw = zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'); const key = JSON.parse(raw.match(/__LONTAR_ANALYSIS_CHUNKS__\[("[^"]+")\]=/)[1]); return { key, fc: JSON.parse(raw.slice(raw.indexOf('={"type"') + 1).trim().replace(/;$/, '')) }; }
function bboxOf(c, b) { if (typeof c[0] === 'number') { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); return b; } for (const x of c) bboxOf(x, b); return b; }
let rng = 777; const rand = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
const ov = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
let fail = 0;
function setup(dir, key, cat) {
  const packs = Object.create(null), all = [];
  for (const fn of fs.readdirSync(path.join(dir, cat.folder, 'packs'))) {
    const { key: chunkKey, fc } = readPack(path.join(dir, cat.folder, 'packs', fn));
    const id = fn.replace('.js.gz', '').replace('_m', ':');
    if (chunkKey !== key + '-pack|' + id) throw new Error('kunci chunk salah ' + chunkKey + ' vs ' + id);
    fc.features.forEach(f => { f.__s = JSON.stringify(f); f.__b = bboxOf(f.geometry.coordinates, [Infinity, Infinity, -Infinity, -Infinity]); all.push(f); });
    packs[id] = fc.features;
  }
  const refs = Object.create(null);
  for (const [c, p] of Object.entries(cat.cells)) { const s = fs.readFileSync(path.join(dir, p), 'utf8'); refs[c] = JSON.parse(s.slice(s.lastIndexOf(']=') + 2).trim().replace(/;$/, '')); }
  return { packs, all, refs };
}
function candidates(S, cat, bbox) { // salinan logika analysisCandidates (dedupe identitas)
  const G = cat.grid, out = [], seen = new Set();
  for (let x = Math.floor(bbox[0] / G); x <= Math.floor(bbox[2] / G); x++) for (let y = Math.floor(bbox[1] / G); y <= Math.floor(bbox[3] / G); y++) {
    const r = S.refs[x + ':' + y]; if (!r) continue;
    r.forEach(p => (S.packs[p] || []).forEach(f => { if (seen.has(f)) return; seen.add(f); if (ov(f.__b, bbox)) out.push(f); }));
  }
  return out;
}
const pc = Object.create(null);
function loadP(dir, folder, rel) { const k = dir + folder + rel; if (!(k in pc)) { const f = path.join(dir, folder, 'pidx', rel); pc[k] = fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f))) : null; } return pc[k]; }
function pidxHits(S, cat, x, y) { // salinan logika pointAnalysisCandidates + filter geometryContains
  const G = cat.grid, cell = Math.floor(x / G) + ':' + Math.floor(y / G); if (!cat.cells[cell]) return [];
  const name = cell.replace(':', '_m'), P = loadP(NEW, cat.folder, name + '.json.gz'); if (!P) throw new Error('pidx hilang ' + cat.folder + ' ' + cell);
  const SG = G / P.sub, sx = Math.floor(x / SG), sy = Math.floor(y / SG), sk = sx + ':' + sy, out = []; let ext = null;
  P.g.forEach((g, gi) => { let piece = g.x[sk]; if (!piece) return; if (piece === 2) { ext = ext || loadP(NEW, cat.folder, name + '/' + sk.replace(/-/g, 'm').replace(':', '_') + '.json.gz'); piece = ext[gi]; }
    const full = S.packs[g.k][g.n]; if (JSON.stringify(full.properties || {}) !== JSON.stringify(g.p)) throw new Error('properti raksasa tidak cocok');
    const geom = piece === 1 ? { type: 'Polygon', coordinates: [[[sx * SG - 1e-9, sy * SG - 1e-9], [(sx + 1) * SG + 1e-9, sy * SG - 1e-9], [(sx + 1) * SG + 1e-9, (sy + 1) * SG + 1e-9], [sx * SG - 1e-9, (sy + 1) * SG + 1e-9], [sx * SG - 1e-9, sy * SG - 1e-9]]] } : { type: 'MultiPolygon', coordinates: piece };
    if (geometryContains(geom, x, y)) out.push(full.__s); });
  for (const [pk, list] of Object.entries(P.p)) for (const e of list) { if (!(e[1] <= x && e[3] >= x && e[2] <= y && e[4] >= y)) continue; const f = S.packs[pk][e[0]]; if (geometryContains(f.geometry, x, y)) out.push(f.__s); }
  return out.sort();
}
const legacyByKey = Object.fromEntries(LEGACY.map(l => [l.key, l]));
for (const [key, cat] of Object.entries(newIndex)) {
  if (!cat.folder || (ONLY && !ONLY.includes(key))) continue;
  const S2 = setup(NEW, key, cat);
  let oldAll, oldCand, oldPoint;
  if (legacyByKey[key]) { // pembanding: berkas legacy utuh
    const raw = fs.readFileSync(legacyByKey[key].file, 'utf8'); const fc = JSON.parse(raw.slice(raw.indexOf('{')).trim().replace(/;\s*$/, ''));
    oldAll = fc.features.filter(f => f.geometry && f.geometry.coordinates).map(f => { f.__s = JSON.stringify(f); f.__b = bboxOf(f.geometry.coordinates, [Infinity, Infinity, -Infinity, -Infinity]); return f; });
    oldCand = bbox => oldAll.filter(f => ov(f.__b, bbox)).map(f => f.__s).sort();
    oldPoint = (x, y) => oldAll.filter(f => f.__b[0] <= x && f.__b[2] >= x && f.__b[1] <= y && f.__b[3] >= y && geometryContains(f.geometry, x, y)).map(f => f.__s).sort();
  } else {
    const S1 = setup(OLD, key, oldIndex[key]); oldAll = S1.all;
    oldCand = bbox => candidates(S1, oldIndex[key], bbox).map(f => f.__s).sort();
    oldPoint = (x, y) => candidates(S1, oldIndex[key], [x, y, x, y]).filter(f => geometryContains(f.geometry, x, y)).map(f => f.__s).sort();
  }
  // (1) lossless
  const a = oldAll.map(f => f.__s).sort(), b = S2.all.map(f => f.__s).sort();
  const lossless = a.length === b.length && a.every((s, i) => s === b[i]);
  // (2) titik & (3) bbox
  const G = cat.grid, cellKeys = Object.keys(cat.cells), big = S2.all.filter(f => f.__s.length > 100000);
  let pd = 0, bd = 0, hits = 0;
  for (let i = 0; i < N; i++) {
    let x, y;
    if (i % 3 === 0 && big.length) { const f = big[Math.floor(rand() * big.length)]; x = f.__b[0] + rand() * (f.__b[2] - f.__b[0]); y = f.__b[1] + rand() * (f.__b[3] - f.__b[1]); }
    else if (i % 3 === 1) { const f = S2.all[Math.floor(rand() * S2.all.length)]; x = f.__b[0] + rand() * (f.__b[2] - f.__b[0]); y = f.__b[1] + rand() * (f.__b[3] - f.__b[1]); }
    else { const c = cellKeys[Math.floor(rand() * cellKeys.length)].split(':').map(Number); x = (c[0] + rand()) * G; y = (c[1] + rand()) * G; }
    if (i % 50 === 0) x = Math.round(x / (G / 5)) * (G / 5);
    if (i % 77 === 0) { const f = S2.all[Math.floor(rand() * S2.all.length)]; let c = f.geometry.coordinates; while (typeof c[0][0] !== 'number') c = c[0]; const v = c[Math.floor(rand() * c.length)]; x = v[0]; y = v[1]; }
    const o = oldPoint(x, y), n = pidxHits(S2, cat, x, y); if (o.length) hits++;
    if (o.join('\n') !== n.join('\n')) { pd++; if (pd <= 2) console.log('  titik beda', key, x, y, o.length, n.length); }
    if (i % 10 === 0) { const w = rand() * 0.08, h = rand() * 0.06, bbox = [x - w / 2, y - h / 2, x + w / 2, y + h / 2]; const oc = oldCand(bbox), nc = candidates(S2, cat, bbox).map(f => f.__s).sort(); if (oc.join('\n') !== nc.join('\n')) { bd++; if (bd <= 2) console.log('  bbox beda', key, bbox, oc.length, nc.length); } }
  }
  const ok = lossless && !pd && !bd; if (!ok) fail++;
  console.log(JSON.stringify({ key, fitur: b.length, lossless, titik: N, berHit: hits, bedaTitik: pd, bedaBbox: bd, ok }));
}
console.log(fail ? 'GAGAL: ' + fail + ' layer' : 'SEMUA LAYER LOLOS');
