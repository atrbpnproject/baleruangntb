/* Bale Ruang NTB — alat "Fasilitas Terdekat" di peta.
 * Pilih alat dari Toolbox (Alat Peta), lalu klik satu titik di peta: sekolah, kesehatan, ibadah,
 * belanja/pasar, dan kantor pemerintahan terdekat langsung tampil di panel dan sebagai penanda di peta.
 * Data dan klasifikasinya memakai logika yang sama dengan bagian "Fasilitas Terdekat" di laporan PDF
 * (BidangReport.fetchFacilities: OpenStreetMap/Overpass, radius 5 km). */
(function () {
  'use strict';
  var map = window.map, L = window.L;
  if (!map || !L || !window.BidangReport) return;

  var GROUPS = [
    { id: 'edu', label: 'Pendidikan', icon: 'fa-school', color: '#2563eb' },
    { id: 'health', label: 'Kesehatan', icon: 'fa-hospital', color: '#dc2626' },
    { id: 'worship', label: 'Ibadah', icon: 'fa-moon', color: '#059669' },
    { id: 'market', label: 'Belanja & pasar', icon: 'fa-shopping-basket', color: '#d97706' },
    { id: 'gov', label: 'Pemerintahan', icon: 'fa-university', color: '#7c3aed' }
  ];
  var PER_GROUP = 3, RADIUS = 5000;
  var state = { picking: false, token: 0, layer: L.layerGroup(), markers: {}, panel: null, lastPickAt: 0, point: null };

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(text, ms) { if (typeof window.toast === 'function') window.toast(text, ms); }
  function fmtDistance(m) { return m >= 1000 ? (m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' km' : (Math.round(m / 10) * 10) + ' m'; }
  function group(id) { return GROUPS.filter(function (g) { return g.id === id; })[0]; }

  var css = document.createElement('style');
  css.textContent =
    '.fac-picking,.fac-picking .leaflet-interactive{cursor:crosshair!important}' +
    '.fac-panel{position:fixed;z-index:1200;right:14px;top:74px;width:min(380px,calc(100vw - 28px));max-height:calc(100dvh - 100px);display:none;flex-direction:column;background:#fff;border-radius:14px;box-shadow:0 12px 34px rgba(8,35,60,.22);font:12px/1.4 Arial,sans-serif;color:#173d5b;overflow:hidden}' +
    '.fac-panel.open{display:flex}' +
    '.fac-head{display:flex;align-items:flex-start;gap:10px;padding:13px 14px 10px;border-bottom:1px solid #e3edf5}' +
    '.fac-head h3{margin:0;font-size:14px;letter-spacing:.02em;color:#0b2a45}.fac-head p{margin:2px 0 0;color:#5a7183;font-size:11px}' +
    '.fac-head button{margin-left:auto;flex:none;width:30px;height:30px;border:0;border-radius:8px;background:#eef4f9;color:#173d5b;cursor:pointer;font-size:14px}' +
    '.fac-body{overflow:auto;padding:4px 14px 8px}' +
    '.fac-group{padding:8px 0;border-bottom:1px solid #eef3f7}.fac-group:last-child{border-bottom:0}' +
    '.fac-group h4{display:flex;align-items:center;gap:7px;margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#5a7183}' +
    '.fac-group h4 i{width:20px;height:20px;border-radius:6px;display:grid;place-items:center;color:#fff;font-size:10px}' +
    '.fac-item{display:flex;align-items:baseline;gap:8px;width:100%;padding:5px 6px;margin:0 -6px;border:0;border-radius:7px;background:transparent;text-align:left;font:inherit;color:inherit;cursor:pointer}' +
    '.fac-item:hover,.fac-item:focus-visible{background:#eaf4fb;outline:0}' +
    '.fac-item span{flex:1;min-width:0}.fac-item small{color:#6b8295}.fac-item b{flex:none;font-variant-numeric:tabular-nums}' +
    '.fac-empty{margin:0;color:#7a8e9d;font-size:11px}' +
    '.fac-foot{display:flex;gap:8px;align-items:center;padding:9px 14px 12px;border-top:1px solid #e3edf5}' +
    '.fac-foot p{flex:1;margin:0;color:#6b8295;font-size:10px}' +
    '.fac-foot button{flex:none;padding:7px 10px;border:0;border-radius:8px;background:#0874bd;color:#fff;font:700 11px Arial,sans-serif;cursor:pointer}' +
    '.fac-msg{padding:18px 4px;color:#5a7183;text-align:center}' +
    '.fac-pin-wrap{background:none;border:0}.fac-pin{box-sizing:border-box;width:24px;height:24px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:grid;place-items:center;color:#fff;font-size:10px}' +
    '@media (max-width:760px){.fac-panel{top:auto;bottom:0;right:0;left:0;width:auto;max-height:55dvh;border-radius:16px 16px 0 0}}';
  document.head.appendChild(css);

  function buildPanel() {
    var el = document.createElement('div');
    el.className = 'fac-panel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Fasilitas terdekat');
    el.innerHTML = '<div class="fac-head"><div><h3>Fasilitas Terdekat</h3><p data-fac-coord></p></div><button type="button" data-fac-close title="Tutup" aria-label="Tutup"><i class="fas fa-times"></i></button></div>' +
      '<div class="fac-body" data-fac-body></div>' +
      '<div class="fac-foot"><p>Jarak garis lurus dari titik yang diklik, radius ' + (RADIUS / 1000) + ' km. Sumber: © kontributor OpenStreetMap; bisa belum lengkap.</p><button type="button" data-fac-again><i class="fas fa-crosshairs"></i> Titik lain</button></div>';
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    el.querySelector('[data-fac-close]').addEventListener('click', clear);
    el.querySelector('[data-fac-again]').addEventListener('click', start);
    el.addEventListener('click', function (e) {
      var item = e.target.closest('[data-fac-id]');
      if (!item) return;
      var marker = state.markers[item.getAttribute('data-fac-id')];
      if (marker) { map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 16), { duration: .6 }); marker.openTooltip(); }
    });
    document.body.appendChild(el);
    return el;
  }
  function panel() { return state.panel || (state.panel = buildPanel()); }

  function setPicking(on) {
    state.picking = on;
    map.getContainer().classList.toggle('fac-picking', on);
  }
  function onKey(e) { if (e.key === 'Escape' && state.picking) { setPicking(false); toast('Pemilihan titik fasilitas dibatalkan.'); } }
  document.addEventListener('keydown', onKey);

  function start() {
    setPicking(true);
    toast('Klik titik atau bidang di peta untuk melihat fasilitas terdekat. Tekan Esc untuk batal.', 4000);
  }

  function clear() {
    state.token++;
    setPicking(false);
    state.layer.clearLayers();
    state.markers = {};
    if (map.hasLayer(state.layer)) map.removeLayer(state.layer);
    if (state.panel) state.panel.classList.remove('open');
  }

  function pinIcon(g) {
    return L.divIcon({ className: 'fac-pin-wrap', html: '<div class="fac-pin" style="background:' + g.color + '"><i class="fas ' + g.icon + '"></i></div>', iconSize: [24, 24], iconAnchor: [12, 12] });
  }

  function render(list, lat, lng) {
    var body = panel().querySelector('[data-fac-body]'), html = [], bounds = [[lat, lng]];
    state.layer.clearLayers();
    state.markers = {};
    L.circle([lat, lng], { radius: RADIUS, color: '#0874bd', weight: 1, dashArray: '4 6', fill: false, interactive: false }).addTo(state.layer);
    L.circleMarker([lat, lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#0b2a45', fillOpacity: 1 }).bindTooltip('Titik acuan').addTo(state.layer);
    GROUPS.forEach(function (g) {
      var items = list.filter(function (f) { return f.group === g.id; })
        .map(function (f) { return { f: f, d: BidangReport.inverse(lat, lng, f.lat, f.lng).dist }; })
        .filter(function (it) { return it.d <= RADIUS; })
        .sort(function (a, b) { return a.d - b.d; }).slice(0, PER_GROUP);
      html.push('<div class="fac-group"><h4><i class="fas ' + g.icon + '" style="background:' + g.color + '"></i>' + esc(g.label) + '</h4>');
      if (!items.length) html.push('<p class="fac-empty">Tidak ditemukan dalam radius ' + (RADIUS / 1000) + ' km.</p>');
      items.forEach(function (it, i) {
        var id = g.id + i;
        html.push('<button type="button" class="fac-item" data-fac-id="' + id + '"><span>' + esc(it.f.name) + ' <small>· ' + esc(it.f.type) + '</small></span><b>' + fmtDistance(it.d) + '</b></button>');
        var m = L.marker([it.f.lat, it.f.lng], { icon: pinIcon(g), keyboard: false })
          .bindTooltip('<b>' + esc(it.f.name) + '</b><br>' + esc(it.f.type) + ' · ' + fmtDistance(it.d), { direction: 'top', offset: [0, -10] });
        m.addTo(state.layer);
        state.markers[id] = m;
        if (i === 0) bounds.push([it.f.lat, it.f.lng]);
      });
      html.push('</div>');
    });
    body.innerHTML = html.join('');
    if (bounds.length > 1) {
      var mobile = window.matchMedia && window.matchMedia('(max-width:760px)').matches, mapBox = map.getContainer().getBoundingClientRect(), pr = panel().getBoundingClientRect();
      var left = 40, layerPanel = document.getElementById('layerPanel');
      if (!mobile && layerPanel) { var lp = layerPanel.getBoundingClientRect(); if (lp.width && lp.right > mapBox.left) left = Math.max(left, lp.right - mapBox.left + 30); }
      map.fitBounds(bounds, mobile
        ? { paddingTopLeft: [30, 130], paddingBottomRight: [30, Math.max(30, mapBox.bottom - pr.top + 20)], maxZoom: 16 }
        : { paddingTopLeft: [left, 40], paddingBottomRight: [Math.max(40, mapBox.right - pr.left + 20), 40], maxZoom: 16 });
    }
  }

  function show(latlng) {
    var lat = latlng.lat, lng = latlng.lng, token = ++state.token, el = panel();
    state.point = latlng;
    el.querySelector('[data-fac-coord]').textContent = lat.toFixed(6) + ', ' + lng.toFixed(6);
    el.querySelector('[data-fac-body]').innerHTML = '<div class="fac-msg"><i class="fas fa-spinner fa-spin"></i> Mengambil data fasilitas…</div>';
    el.classList.add('open');
    state.layer.clearLayers();
    state.markers = {};
    L.circleMarker([lat, lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#0b2a45', fillOpacity: 1 }).addTo(state.layer);
    if (!map.hasLayer(state.layer)) state.layer.addTo(map);
    BidangReport.fetchFacilities(lat, lng).then(function (list) {
      if (token !== state.token) return;
      render(list, lat, lng);
    }, function () {
      if (token !== state.token) return;
      el.querySelector('[data-fac-body]').innerHTML = '<div class="fac-msg">Data fasilitas tidak dapat diambil. Periksa koneksi internet, lalu klik <b>Titik lain</b> untuk mencoba lagi.</div>';
    });
  }

  // Dipanggil dari handler klik peta utama sebelum analisis titik. true = klik sudah dipakai alat ini.
  function handleClick(latlng) {
    if (!state.picking) return false;
    setPicking(false);
    state.lastPickAt = Date.now();
    show(latlng);
    return true;
  }

  window.FasilitasTool = {
    start: start, clear: clear, show: show, handleClick: handleClick,
    isPicking: function () { return state.picking; },
    justPicked: function () { return Date.now() - state.lastPickAt < 400; }
  };
})();
