/* Bale Ruang NTB — layer Persil / Bidang Tanah dari layanan peta luar (WMS, ArcGIS REST, XYZ, vector tile).
 * Konfigurasi sumber ada di js/persil-config.js. Modul ini mandiri: menambah satu bagian di panel layer,
 * satu pane peta, dan popup info persil saat peta diklik (berjalan berdampingan dengan analisis titik). */
(function () {
  'use strict';
  var map = window.map, L = window.L;
  if (!map || !L) return;
  var config = window.BALE_PERSIL_CONFIG || { sources: [] };
  var CUSTOM_KEY = 'baleRuangPersilCustom', SOURCE_KEY = 'baleRuangPersilSource';
  var VECTORGRID_URL = 'https://unpkg.com/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.js';
  var state = { on: false, source: null, layer: null, highlight: null, measuring: false, token: 0, vectorGridPromise: null };

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(key, value) { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) {} }
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function toast(text) { if (typeof window.toast === 'function') window.toast(text); else { var s = document.getElementById('mapStatus'); if (s) s.textContent = text; } }

  function sources() {
    var list = (config.sources || []).slice();
    if (config.allowCustomSource !== false) {
      var custom = null;
      try { custom = JSON.parse(load(CUSTOM_KEY) || 'null'); } catch (e) {}
      list.push(Object.assign({ id: 'custom', name: 'URL layanan sendiri', type: 'wms', url: '', layers: '', minZoom: 15, custom: true }, custom || {}, { id: 'custom', custom: true }));
    }
    return list;
  }
  function findSource(id) { return sources().filter(function (s) { return s.id === id; })[0] || null; }
  function isConfigured(src) { return !!(src && src.url && (src.type !== 'wms' || src.layers) && (src.type !== 'arcgis' || /MapServer\/?$/i.test(src.url))); }
  function minZoom(src) { return src && src.minZoom != null ? Number(src.minZoom) : 15; }
  function withParams(url, params) {
    var q = Object.keys(params || {}).filter(function (k) { return params[k] != null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return q ? url + (url.indexOf('?') >= 0 ? '&' : '?') + q : url;
  }

  /* ---------- Pane: di atas layer tata ruang, di bawah penanda & popup ---------- */
  map.createPane('persilPane');
  map.getPane('persilPane').style.zIndex = 460;
  map.createPane('persilHighlightPane');
  map.getPane('persilHighlightPane').style.zIndex = 470;
  map.getPane('persilHighlightPane').style.pointerEvents = 'none';

  /* ---------- Pembuat layer per jenis sumber ---------- */
  var ArcGISExportLayer = L.TileLayer.extend({
    getTileUrl: function (coords) {
      var size = this.getTileSize(), nw = map.unproject(coords.scaleBy(size), coords.z),
        se = map.unproject(coords.add([1, 1]).scaleBy(size), coords.z),
        a = L.CRS.EPSG3857.project(nw), b = L.CRS.EPSG3857.project(se), src = this.options.source;
      return withParams(src.url.replace(/\/$/, '') + '/export', Object.assign({
        bbox: [a.x, b.y, b.x, a.y].join(','), bboxSR: 3857, imageSR: 3857, size: size.x + ',' + size.y,
        dpi: 96, format: 'png32', transparent: true, layers: src.layers ? 'show:' + src.layers : '', f: 'image'
      }, src.params || {}));
    }
  });

  function loadVectorGrid() {
    if (L.vectorGrid) return Promise.resolve();
    if (state.vectorGridPromise) return state.vectorGridPromise;
    state.vectorGridPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = VECTORGRID_URL; s.onload = function () { L.vectorGrid ? resolve() : reject(new Error('VectorGrid')); };
      s.onerror = function () { state.vectorGridPromise = null; reject(new Error('VectorGrid')); };
      document.head.appendChild(s);
    });
    return state.vectorGridPromise;
  }

  function buildLayer(src) {
    var common = { pane: 'persilPane', minZoom: minZoom(src), maxZoom: 22, maxNativeZoom: src.maxNativeZoom || 20, attribution: src.attribution || '', opacity: src.opacity != null ? src.opacity : 1 };
    if (src.type === 'wms') {
      return Promise.resolve(L.tileLayer.wms(src.url, Object.assign({}, common, src.params || {}, {
        layers: src.layers, styles: src.styles || '', format: src.format || 'image/png', transparent: true, version: src.version || '1.1.1', tiled: true
      })));
    }
    if (src.type === 'arcgis') return Promise.resolve(new ArcGISExportLayer('', Object.assign({}, common, { source: src })));
    if (src.type === 'xyz') return Promise.resolve(L.tileLayer(withParams(src.url, src.params), common));
    if (src.type === 'mvt') {
      return loadVectorGrid().then(function () {
        var style = { weight: 1.2, color: '#ffd400', opacity: 1, fill: true, fillColor: '#ffd400', fillOpacity: 0.08 };
        var opts = Object.assign({}, common, {
          rendererFactory: L.canvas.tile, interactive: true,
          getFeatureId: function (f) { return f.properties && f.properties[src.idField || 'id']; },
          vectorTileLayerStyles: {}
        });
        // Gaya sama untuk semua layer di dalam tile (nama layer bisa berbeda antar server).
        opts.vectorTileLayerStyles = new Proxy({}, { get: function (t, name) { return (!src.vectorLayer || name === src.vectorLayer) ? style : []; } });
        var layer = L.vectorGrid.protobuf(withParams(src.url, src.params), opts);
        layer.on('click', function (e) {
          if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
          state.vectorClickAt = Date.now();
          showVectorFeature(src, e.latlng, e.layer && e.layer.properties || {});
        });
        return layer;
      });
    }
    return Promise.reject(new Error('Jenis sumber tidak dikenal: ' + src.type));
  }

  /* ---------- Info persil saat peta diklik ---------- */
  function clearHighlight() { if (state.highlight) { map.removeLayer(state.highlight); state.highlight = null; } }
  function drawHighlight(geometry) {
    clearHighlight();
    if (!geometry) return;
    var sample = JSON.stringify(geometry.coordinates || []).match(/-?\d+(\.\d+)?/g) || [];
    if (sample.some(function (n) { return Math.abs(Number(n)) > 180; })) return; // bukan derajat (mis. EPSG:3857) — lewati sorotan
    state.highlight = L.geoJSON({ type: 'Feature', properties: {}, geometry: geometry }, {
      pane: 'persilHighlightPane', interactive: false, style: { color: '#00e5ff', weight: 3, fillColor: '#00e5ff', fillOpacity: 0.15 }
    }).addTo(map);
  }
  function attributeTable(src, props) {
    var fields = src.fields || {}, keys = Object.keys(fields).filter(function (k) { return props[k] != null && props[k] !== ''; });
    Object.keys(props).forEach(function (k) {
      if (keys.indexOf(k) < 0 && props[k] != null && props[k] !== '' && typeof props[k] !== 'object' && !/^(shape|objectid|fid|the_geom|geom|bbox)/i.test(k)) keys.push(k);
    });
    keys = keys.slice(0, 20);
    if (!keys.length) return '<p class="persil-empty">Atribut bidang tidak tersedia dari sumber ini.</p>';
    return '<table class="persil-table">' + keys.map(function (k) { return '<tr><th>' + esc(fields[k] || k) + '</th><td>' + esc(props[k]) + '</td></tr>'; }).join('') + '</table>';
  }
  function openPopup(latlng, html) {
    L.popup({ className: 'persil-popup', maxWidth: 320, autoPanPaddingTopLeft: [innerWidth > 760 ? 370 : 20, 90] }).setLatLng(latlng).setContent(html).openOn(map);
  }
  function popupShell(src, body, count) {
    return '<div class="persil-info"><div class="persil-info-head"><i class="fas fa-vector-square" aria-hidden="true"></i> Persil'
      + (count > 1 ? ' (' + count + ' bidang)' : '') + '<small>' + esc(src.name) + '</small></div>' + body
      + '<p class="persil-note">Informasi persil bersifat informatif; rujukan resmi tetap Kantor Pertanahan setempat.</p></div>';
  }

  function identifyRequest(src, latlng) {
    var size = map.getSize(), bounds = map.getBounds(), point = map.latLngToContainerPoint(latlng).round();
    if (src.type === 'wms') {
      var sw = L.CRS.EPSG3857.project(bounds.getSouthWest()), ne = L.CRS.EPSG3857.project(bounds.getNorthEast()),
        v13 = String(src.version || '1.1.1') === '1.3.0', params = Object.assign({}, src.params || {}, {
          SERVICE: 'WMS', VERSION: src.version || '1.1.1', REQUEST: 'GetFeatureInfo', LAYERS: src.layers, QUERY_LAYERS: src.layers,
          STYLES: src.styles || '', BBOX: [sw.x, sw.y, ne.x, ne.y].join(','), WIDTH: size.x, HEIGHT: size.y,
          INFO_FORMAT: src.infoFormat || 'application/json', FEATURE_COUNT: 5
        });
      params[v13 ? 'CRS' : 'SRS'] = 'EPSG:3857';
      params[v13 ? 'I' : 'X'] = point.x; params[v13 ? 'J' : 'Y'] = point.y;
      return fetch(withParams(src.url, params)).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var type = r.headers.get('content-type') || '';
        return /json/.test(type) ? r.json().then(function (j) {
          return (j.features || []).map(function (f) { return { properties: f.properties || {}, geometry: f.geometry }; });
        }) : r.text().then(function (t) {
          var div = document.createElement('div'); div.innerHTML = t.replace(/<script[\s\S]*?<\/script>/gi, '');
          var text = (div.textContent || '').replace(/\s+/g, ' ').trim();
          return text ? [{ properties: { Keterangan: text.slice(0, 600) } }] : [];
        });
      });
    }
    if (src.type === 'arcgis') {
      return fetch(withParams(src.url.replace(/\/$/, '') + '/identify', Object.assign({
        geometry: latlng.lng + ',' + latlng.lat, geometryType: 'esriGeometryPoint', sr: 4326,
        layers: 'all' + (src.layers ? ':' + src.layers : ''), tolerance: 2,
        mapExtent: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(','),
        imageDisplay: size.x + ',' + size.y + ',96', returnGeometry: true, f: 'json'
      }, src.params || {}))).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
        if (j.error) throw new Error(j.error.message || 'ArcGIS error');
        return (j.results || []).map(function (res) {
          var g = res.geometry, geometry = g && g.rings ? { type: 'Polygon', coordinates: g.rings } : null;
          return { properties: res.attributes || {}, geometry: geometry };
        });
      });
    }
    if (src.identifyUrl) {
      var url = src.identifyUrl.replace('{lat}', latlng.lat.toFixed(7)).replace('{lng}', latlng.lng.toFixed(7)).replace('{lon}', latlng.lng.toFixed(7));
      return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
        var list = j.features || (Array.isArray(j) ? j : [j]);
        return list.map(function (f) { return { properties: f.properties || f, geometry: f.geometry }; });
      });
    }
    return Promise.resolve(null);
  }

  function identify(latlng) {
    var src = state.source, token = ++state.token;
    if (!state.on || !src || state.measuring || map.getZoom() < minZoom(src)) return;
    if (src.type === 'mvt') return; // ditangani klik pada bidang vector tile
    var request = identifyRequest(src, latlng);
    request.then(function (rows) {
      if (token !== state.token || rows == null) return;
      if (!rows.length) { clearHighlight(); return; }
      drawHighlight(rows[0].geometry);
      openPopup(latlng, popupShell(src, rows.map(function (row) { return attributeTable(src, row.properties || {}); }).join('<hr>'), rows.length));
    }).catch(function (err) {
      if (token !== state.token) return;
      toast('Info persil tidak dapat diambil dari ' + src.name + ' (' + (err && err.message || 'gagal') + '). Periksa akses/CORS layanan.');
    });
  }

  function showVectorFeature(src, latlng, props) {
    clearHighlight();
    var shell = function (p, extra) { return popupShell(src, attributeTable(src, p) + (extra || ''), 1); };
    openPopup(latlng, shell(props, src.detailUrl ? '<p class="persil-loading"><i class="fas fa-spinner fa-spin"></i> Mengambil detail…</p>' : ''));
    var id = props[src.idField || 'id'];
    if (!src.detailUrl || id == null) return;
    fetch(src.detailUrl.replace('{id}', encodeURIComponent(id))).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (detail) { openPopup(latlng, shell(Object.assign({}, props, detail && detail.properties || detail || {}))); })
      .catch(function () { openPopup(latlng, shell(props, '<p class="persil-empty">Detail tambahan tidak dapat diambil.</p>')); });
  }

  map.on('click', function (e) { if (state.vectorClickAt && Date.now() - state.vectorClickAt < 300) return; identify(e.latlng); });
  map.on('measurestart', function () { state.measuring = true; });
  map.on('measurefinish', function () { state.measuring = false; });

  /* ---------- Panel layer ---------- */
  var ui = {};
  function setMeta(text, cls) { ui.meta.textContent = text; ui.row.className = 'layer persil-row' + (cls ? ' ' + cls : ''); }
  function refreshMeta() {
    var src = state.source;
    if (!state.on) { setMeta(src && isConfigured(src) ? 'Siap • ' + src.name : 'Pilih sumber persil', ''); return; }
    if (!isConfigured(src)) { setMeta('Endpoint ' + (src ? src.name : '') + ' belum dikonfigurasi', 'error'); return; }
    if (map.getZoom() < minZoom(src)) { setMeta('Aktif • perbesar hingga zoom ' + minZoom(src) + ' untuk melihat bidang', 'loading'); return; }
    setMeta('Aktif • ' + src.name + ' • klik bidang untuk info', 'ready');
  }
  function removeLayer() { if (state.layer) { map.removeLayer(state.layer); state.layer = null; } clearHighlight(); map.closePopup(); }
  function activate() {
    removeLayer();
    var src = state.source, token = ++state.token;
    if (!state.on) { refreshMeta(); return; }
    if (!isConfigured(src)) {
      refreshMeta();
      toast(src && src.custom ? 'Isi URL layanan persil terlebih dahulu.' : 'Endpoint persil ' + (src ? src.name : '') + ' belum diisi di js/persil-config.js.');
      if (src && src.custom) ui.form.hidden = false;
      return;
    }
    setMeta('Memuat ' + src.name + '…', 'loading');
    buildLayer(src).then(function (layer) {
      if (token !== state.token || !state.on) return;
      var errors = 0;
      layer.on('tileerror', function () { if (++errors === 4) toast('Sebagian tile persil gagal dimuat dari ' + src.name + '. Periksa akses layanan.'); });
      state.layer = layer.addTo(map);
      refreshMeta();
      if (map.getZoom() < minZoom(src)) toast('Layer persil tampil mulai zoom ' + minZoom(src) + '. Perbesar peta ke lokasi bidang.');
    }).catch(function (err) { if (token === state.token) { setMeta('Gagal memuat: ' + (err && err.message || 'kesalahan'), 'error'); } });
  }

  function renderSourceOptions(selectedId) {
    ui.select.innerHTML = sources().map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === selectedId ? ' selected' : '') + '>' + esc(s.name) + (isConfigured(s) ? '' : ' — belum dikonfigurasi') + '</option>';
    }).join('');
  }

  function buildPanel() {
    var base = document.getElementById('baseList'), theme = document.getElementById('themeList');
    if (!base || !theme) return;
    var title = document.createElement('div');
    title.className = 'section-title'; title.style.marginTop = '14px'; title.textContent = 'Persil / bidang tanah';
    var wrap = document.createElement('div'); wrap.id = 'persilList';
    wrap.innerHTML = '<div class="layer persil-row"><div><div class="layer-title">Persil (Bidang Tanah)<span class="layer-legal">Layanan peta resmi • tampil mulai zoom dekat</span></div>'
      + '<div class="layer-meta">Pilih sumber persil</div>'
      + '<div class="persil-source"><label for="persilSource">Sumber</label><select id="persilSource"></select>'
      + '<button type="button" class="persil-edit" title="Atur URL layanan sendiri" aria-label="Atur URL layanan sendiri" hidden><i class="fas fa-cog" aria-hidden="true"></i></button></div>'
      + '<form class="persil-custom" hidden><label>Jenis layanan<select name="type"><option value="wms">WMS</option><option value="arcgis">ArcGIS REST MapServer</option><option value="xyz">Tile XYZ (raster)</option><option value="mvt">Vector tile (.pbf)</option></select></label>'
      + '<label>URL layanan<input name="url" type="url" required placeholder="https://…/wms atau …/MapServer"></label>'
      + '<label>Nama layer / sublayer<input name="layers" type="text" placeholder="mis. persil atau 0"></label>'
      + '<label>Zoom minimum<input name="minZoom" type="number" min="8" max="20" value="15"></label>'
      + '<div class="persil-custom-actions"><button type="submit">Simpan &amp; tampilkan</button><button type="button" data-clear>Hapus</button></div>'
      + '<p>Tersimpan hanya di browser ini. Gunakan endpoint resmi yang Anda miliki izinnya.</p></form></div>'
      + '<label class="switch"><input type="checkbox" aria-label="Tampilkan layer persil"><span class="track"></span></label></div>';
    base.insertAdjacentElement('afterend', wrap);
    wrap.insertAdjacentElement('beforebegin', title);
    ui.row = wrap.querySelector('.layer'); ui.meta = wrap.querySelector('.layer-meta'); ui.select = wrap.querySelector('select#persilSource');
    ui.input = wrap.querySelector('.switch input'); ui.form = wrap.querySelector('.persil-custom'); ui.edit = wrap.querySelector('.persil-edit');

    var initial = findSource(load(SOURCE_KEY)) || findSource(config.defaultSource) || sources()[0] || null;
    state.source = initial;
    renderSourceOptions(initial && initial.id);
    function syncCustomUi() {
      var custom = state.source && state.source.custom;
      ui.edit.hidden = !custom;
      if (!custom) ui.form.hidden = true;
      if (custom) {
        ui.form.type.value = state.source.type || 'wms'; ui.form.url.value = state.source.url || '';
        ui.form.layers.value = state.source.layers || ''; ui.form.minZoom.value = minZoom(state.source);
        if (!isConfigured(state.source)) ui.form.hidden = false;
      }
    }
    syncCustomUi(); refreshMeta();

    L.DomEvent.disableClickPropagation(wrap);
    ui.input.addEventListener('change', function () { state.on = this.checked; activate(); });
    ui.select.addEventListener('change', function () { state.source = findSource(this.value); store(SOURCE_KEY, this.value); syncCustomUi(); activate(); });
    ui.edit.addEventListener('click', function () { ui.form.hidden = !ui.form.hidden; });
    ui.form.addEventListener('submit', function (event) {
      event.preventDefault();
      var f = ui.form, custom = { type: f.type.value, url: f.url.value.trim(), layers: f.layers.value.trim(), minZoom: Number(f.minZoom.value) || 15, vectorLayer: '', idField: 'id' };
      store(CUSTOM_KEY, JSON.stringify(custom));
      state.source = findSource('custom'); renderSourceOptions('custom'); store(SOURCE_KEY, 'custom');
      ui.form.hidden = true; state.on = ui.input.checked = true; activate();
    });
    ui.form.querySelector('[data-clear]').addEventListener('click', function () {
      store(CUSTOM_KEY, null); state.source = findSource('custom'); renderSourceOptions('custom'); syncCustomUi(); activate();
    });
    map.on('zoomend', refreshMeta);
  }

  var css = document.createElement('style');
  css.textContent = '.persil-source{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:10px;color:#557087}'
    + '.persil-source select{flex:1;min-width:0;padding:4px 6px;border:1px solid #cddbe6;border-radius:8px;background:#fff;color:#123f65;font-size:11px}'
    + '.persil-edit{padding:4px 7px;border:1px solid #cddbe6;border-radius:8px;background:#fff;color:#0878cf;cursor:pointer}'
    + '.persil-custom{display:grid;gap:6px;margin-top:8px;padding:8px;border:1px solid #d7e5ef;border-radius:10px;background:#f7fbfe;font-size:10px;color:#3c5568}'
    + '.persil-custom[hidden]{display:none}.persil-custom label{display:grid;gap:3px;font-weight:700}'
    + '.persil-custom input,.persil-custom select{padding:5px 7px;border:1px solid #cddbe6;border-radius:7px;font-size:11px;font-weight:400}'
    + '.persil-custom-actions{display:flex;gap:6px}.persil-custom-actions button{padding:6px 10px;border:0;border-radius:8px;background:#0878cf;color:#fff;font-weight:700;cursor:pointer}'
    + '.persil-custom-actions [data-clear]{background:#e6eef4;color:#36536a}.persil-custom p{margin:0;color:#72879a;font-size:9px}'
    + '.persil-row.error .layer-meta{color:#b3261e}'
    + '.persil-popup .leaflet-popup-content{margin:10px 12px;min-width:220px}.persil-info-head{display:flex;align-items:center;gap:6px;margin-bottom:6px;color:#083f70;font-weight:800;font-size:12px}'
    + '.persil-info-head small{margin-left:auto;color:#72879a;font-weight:600;font-size:9px}'
    + '.persil-table{width:100%;border-collapse:collapse;font-size:11px}.persil-table th,.persil-table td{padding:3px 5px;border:1px solid #d7e1e8;text-align:left;vertical-align:top}'
    + '.persil-table th{width:40%;background:#edf4f8;color:#36536a}.persil-note,.persil-empty,.persil-loading{margin:6px 0 0;color:#72879a;font-size:9px}';
  document.head.appendChild(css);

  buildPanel();
  window.BalePersil = { identify: identify, sources: sources, state: state };
})();
