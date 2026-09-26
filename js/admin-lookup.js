(function () {
  'use strict';
  var pending = Object.create(null);
  function load(id) {
    var cache = window.__NTB_ADMIN_FEATURES__ || {};
    if (cache[id]) return Promise.resolve(cache[id]);
    if (pending[id]) return pending[id];
    pending[id] = new Promise(function (resolve, reject) {
      var script = document.createElement('script'), timer;
      function finish(error) {
        clearTimeout(timer); script.remove();
        if (error) { delete pending[id]; reject(error); }
        else resolve(window.__NTB_ADMIN_FEATURES__[id]);
      }
      script.src = 'data/admin-index/' + id + '.js';
      script.onload = function () { finish(window.__NTB_ADMIN_FEATURES__ && window.__NTB_ADMIN_FEATURES__[id] ? null : new Error('Data administrasi kosong')); };
      script.onerror = function () { finish(new Error('Data administrasi lokal tidak tersedia')); };
      timer = setTimeout(function () { finish(new Error('Waktu baca administrasi lokal habis')); }, 8000);
      document.head.appendChild(script);
    });
    return pending[id];
  }
  window.ntbAdminLookup = async function (lng, lat, contains) {
    var index = window.__NTB_ADMIN_INDEX__;
    if (!index) throw new Error('Indeks administrasi lokal tidak tersedia');
    var candidates = index.filter(function (entry) { var b = entry.bbox; return lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]; });
    var hits = [], seen = new Set();
    // At most two intact village features in flight. No province-wide geometry parse.
    for (var start = 0; start < candidates.length; start += 2) {
      var features = await Promise.all(candidates.slice(start, start + 2).map(function (entry) { return load(entry.id); }));
      features.forEach(function (feature) { var id=feature.id==null?(feature.properties||{}).OBJECTID:feature.id;if(seen.has(id))return;seen.add(id);if (contains(feature.geometry, lng, lat)) hits.push(feature); });
    }
    return hits;
  };
})();
