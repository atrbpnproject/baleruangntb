'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const DIR=process.argv[2],N=+(process.argv[3]||20000);
function inRing(x,y,ring){var inside=false;for(var i=0,j=ring.length-1;i<ring.length;j=i++){var xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside}return inside}
function inPolygon(x,y,rings){if(!rings||!rings.length||!inRing(x,y,rings[0]))return false;for(var i=1;i<rings.length;i++)if(inRing(x,y,rings[i]))return false;return true}
function geometryContains(g,x,y){if(!g)return false;if(g.type==='Polygon')return inPolygon(x,y,g.coordinates);if(g.type==='MultiPolygon')return g.coordinates.some(function(p){return inPolygon(x,y,p)});return false}
const s=fs.readFileSync(path.join(DIR,'index.js'),'utf8');const index=JSON.parse(s.slice(s.indexOf('=')+1,s.indexOf('];window.')+1));
console.log('urutan id = posisi:',index.every((e,i)=>e.id===i));
global.window={__NTB_ADMIN_FEATURES__:{}};
const feats={};for(const e of index){const r=fs.readFileSync(path.join(DIR,e.id+'.js'),'utf8');feats[e.id]=JSON.parse(r.slice(r.indexOf(']=')+2).trim().replace(/;$/,''));}
function oldL(x,y){const hits=[],seen=new Set();index.filter(e=>{const b=e.bbox;return x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]}).forEach(e=>{const f=feats[e.id];const id=f.id==null?(f.properties||{}).OBJECTID:f.id;if(seen.has(id))return;seen.add(id);if(geometryContains(f.geometry,x,y))hits.push(JSON.stringify(f.properties))});return hits}
const pc={};const cells=new Set(JSON.parse(fs.readFileSync(path.join(DIR,'pidx/cells.json'))));
function gzj(rel){if(!(rel in pc))pc[rel]=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR,'pidx',rel))));return pc[rel]}
function newL(x,y){const G=0.1,cell=Math.floor(x/G)+':'+Math.floor(y/G);if(!cells.has(cell))return[];const name=cell.replace(':','_m'),P=gzj(name+'.json.gz');const sub=G/P.sub,sx=Math.floor(x/sub),sy=Math.floor(y/sub),sk=sx+':'+sy;const found=[];let ext=null;
 P.g.forEach((g,gi)=>{let piece=g.x[sk];if(!piece)return;if(piece===2){ext=ext||gzj(name+'/'+sk.replace(/-/g,'m').replace(':','_')+'.json.gz');piece=ext[gi]}found.push({order:g.id,f:{id:g.fid,properties:g.p,geometry:piece===1?{type:'Polygon',coordinates:[[[sx*sub-1e-9,sy*sub-1e-9],[(sx+1)*sub+1e-9,sy*sub-1e-9],[(sx+1)*sub+1e-9,(sy+1)*sub+1e-9],[sx*sub-1e-9,(sy+1)*sub+1e-9],[sx*sub-1e-9,sy*sub-1e-9]]]}:{type:'MultiPolygon',coordinates:piece}}})});
 P.s.forEach(e=>{if(x>=e[1]&&x<=e[3]&&y>=e[2]&&y<=e[4])found.push({order:e[0],f:feats[e[0]]})});
 found.sort((a,b)=>a.order-b.order);const hits=[],seen=new Set();found.forEach(it=>{const f=it.f;const id=f.id==null?(f.properties||{}).OBJECTID:f.id;if(seen.has(id))return;seen.add(id);if(geometryContains(f.geometry,x,y))hits.push(JSON.stringify(f.properties))});return hits}
let rng=99;const rand=()=>{rng=(rng*1103515245+12345)&0x7fffffff;return rng/0x7fffffff};
const big=index.filter(e=>JSON.stringify(feats[e.id]).length>300000);let diff=0,hit=0;
for(let i=0;i<N;i++){let e=(i%2?big:index)[Math.floor(rand()*(i%2?big.length:index.length))],b=e.bbox,x=b[0]+rand()*(b[2]-b[0]),y=b[1]+rand()*(b[3]-b[1]);
 if(i%40===0)x=Math.round(x/0.02)*0.02; if(i%61===0){let c=feats[e.id].geometry.coordinates;while(typeof c[0][0]!=='number')c=c[0];const v=c[Math.floor(rand()*c.length)];x=v[0];y=v[1]}
 const a=oldL(x,y).join('|'),bb=newL(x,y).join('|');if(a)hit++;if(a!==bb){diff++;if(diff<4)console.log('beda',x,y,a.slice(0,80),'//',bb.slice(0,80))}}
console.log(JSON.stringify({titik:N,berDesa:hit,beda:diff}));
