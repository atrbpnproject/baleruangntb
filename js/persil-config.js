/* Bale Ruang NTB — konfigurasi sumber layer Persil / Bidang Tanah.
 *
 * Layer persil TIDAK disimpan di repo ini. Peta hanya menampilkan layanan peta (WMS / ArcGIS / tile)
 * dari sumber resmi yang alamatnya diisi di bawah. Selama `url` kosong, sumber tampil sebagai
 * "belum dikonfigurasi" dan tidak ada permintaan apa pun yang dikirim.
 *
 * Jenis sumber (`type`):
 *   'wms'    — OGC WMS (GeoServer, MapServer, ArcGIS WMS). Klik peta = GetFeatureInfo.
 *   'arcgis' — ArcGIS REST MapServer (…/MapServer). Gambar dari /export, klik peta = /identify.
 *   'xyz'    — Tile raster {z}/{x}/{y}. Klik peta memakai `identifyUrl` bila diisi.
 *   'mvt'    — Vector tile {z}/{x}/{y}.pbf (mis. Martin/PostGIS). Klik bidang = atribut dari tile,
 *              lalu `detailUrl` (opsional) dipanggil untuk atribut tambahan.
 *   'file'   — File statis: GeoJSON, Shapefile (.zip berisi .shp/.dbf/.prj), atau KML. `url` boleh berupa
 *              path di repo ini (mis. 'data/persil/selong.geojson'), URL lain yang mengizinkan CORS, atau link
 *              berbagi Google Drive (diubah otomatis ke link unduh; Google sering memblokirnya — lihat README).
 *              Semua bidang dimuat sekaligus, jadi cocok untuk satu desa/kecamatan, bukan satu provinsi.
 *   Selain itu, panel selalu punya pilihan "File dari komputer" (tombol unggah) yang dibaca di browser saja.
 *
 * Kolom umum: id, name, type, url, minZoom (default 15), maxNativeZoom, attribution, opacity,
 *   params (parameter tambahan untuk setiap permintaan, mis. { token: '...' } untuk ArcGIS),
 *   fields (urutan & label atribut di popup, mis. { NIB: 'NIB', TIPEHAK: 'Jenis hak' }).
 * Khusus wms: layers, styles, version ('1.1.1' | '1.3.0'), infoFormat (default 'application/json').
 * Khusus arcgis: layers (id sublayer, mis. '0' atau '0,1').
 * Khusus mvt: vectorLayer (nama layer dalam tile; kosong = semua), idField, detailUrl ('…/{id}').
 *
 * Catatan akses & lisensi (dicek 16-11-2026):
 * - BHUMI (bhumi.atrbpn.go.id) menampilkan persil lewat WMS layer `bhumi_persil` di balik proxy
 *   `/mprx/service` yang mewajibkan token sesi aplikasi BHUMI (tanpa token: HTTP 403). Itu bukan
 *   layanan publik, jadi jangan menyalin token dari situs BHUMI ke sini. Mintalah endpoint WMS/ArcGIS
 *   resmi (beserta kredensial/whitelist domain bila perlu) ke Pusdatin Kementerian ATR/BPN, lalu isi `url`.
 * - BumiAtlas menyajikan vector tile dari server miliknya sendiri; datanya tidak berlisensi terbuka.
 *   Gunakan hanya bila ada izin/kerja sama tertulis dengan pengelola BumiAtlas.
 */
window.BALE_PERSIL_CONFIG = {
  // Sumber yang aktif saat layer pertama kali dinyalakan (id di bawah).
  defaultSource: 'bhumi',
  // Izinkan pengguna mengisi URL layanan sendiri dari panel layer (tersimpan di browser masing-masing).
  allowCustomSource: true,
  // Label atribut untuk file yang diunggah dari komputer.
  fileFields: { NIB: 'NIB', TIPEHAK: 'Jenis hak', HAK: 'Hak', LUASTERTUL: 'Luas tertulis (m²)', LUAS: 'Luas (m²)', DESA: 'Desa/Kelurahan', KECAMATAN: 'Kecamatan' },
  sources: [
    {
      id: 'bhumi',
      name: 'BHUMI ATR/BPN',
      type: 'wms',
      url: '',                       // contoh: 'https://<endpoint-resmi-atrbpn>/geoserver/wms'
      layers: 'bhumi_persil',
      version: '1.1.1',
      infoFormat: 'application/json',
      minZoom: 15,
      attribution: '© Kementerian ATR/BPN — BHUMI',
      fields: { NIB: 'NIB', TIPEHAK: 'Jenis hak', LUASTERTUL: 'Luas tertulis (m²)', LUASPETA: 'Luas peta (m²)', KECAMATAN: 'Kecamatan', DESA: 'Desa/Kelurahan' }
    },
    {
      id: 'bumiatlas',
      name: 'BumiAtlas',
      type: 'mvt',
      url: '',                       // contoh (perlu izin pengelola): 'https://<tile-server>/{z}/{x}/{y}.pbf'
      vectorLayer: '',
      idField: 'id',
      detailUrl: '',                 // contoh: 'https://<api>/persil/{id}'
      minZoom: 15,
      attribution: '© BumiAtlas',
      fields: { id: 'ID', luas: 'Luas (m²)', jenis_hak: 'Jenis hak', nib: 'NIB' }
    },
    {
      id: 'file',
      name: 'File persil (GeoJSON / SHP / KML)',
      type: 'file',
      url: '',                       // contoh: 'data/persil/persil-selong.geojson' atau link Google Drive
      minZoom: 14,
      attribution: 'Data persil manual',
      fields: { NIB: 'NIB', TIPEHAK: 'Jenis hak', HAK: 'Hak', LUASTERTUL: 'Luas tertulis (m²)', LUAS: 'Luas (m²)', DESA: 'Desa/Kelurahan', KECAMATAN: 'Kecamatan' }
    }
  ]
};
