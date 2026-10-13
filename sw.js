/* Bale Ruang NTB — service worker ringan.
   - Halaman (navigasi): ambil dari jaringan dulu, cadangan dari cache bila offline.
   - Berkas tampilan (js/css/gambar/font): cepat dari cache, diperbarui di latar.
   - Data tata ruang (data/...) & peta dasar: selalu dari jaringan (tidak disimpan, agar memori HP tidak penuh). */
var VERSION = 'bale-ruang-20261013c';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/leaflet.css', 'js/leaflet.js',
  'images/bale-ruang-ntb-logo-v3.png', 'images/app/icon-192.png', 'images/app/icon-512.png'];
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(VERSION).then(function (cache) { return cache.addAll(SHELL); }).catch(function () {}));
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // peta dasar, layanan luar: biarkan browser
  if (url.pathname.indexOf('/data/') >= 0) return;           // data tata ruang: selalu dari jaringan
  if (url.pathname.indexOf('/regulasi/') >= 0) return;       // dokumen regulasi (PDF): langsung dari jaringan
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(function (res) {
      var type = res.headers.get('content-type') || '';
      if (res.ok && type.indexOf('text/html') >= 0) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put('index.html', copy); }); }
      return res;
    }).catch(function () { return caches.match('index.html').then(function (r) { return r || caches.match('./'); }); }));
    return;
  }
  if (/\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(caches.open(VERSION).then(function (cache) {
      return cache.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
  }
});
