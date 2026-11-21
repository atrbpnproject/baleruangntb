# baleruangntb
Bale Ruang NTB -  Satu Tempat, Seluruh Informasi Ruang

## Layer Persil / Bidang Tanah

Panel layer punya bagian **Persil / bidang tanah** dengan pilihan sumber (BHUMI, BumiAtlas, atau URL layanan sendiri).
Data persil tidak disimpan di repo; peta hanya memanggil layanan peta yang alamatnya diisi di `js/persil-config.js`.

Jenis layanan yang didukung:

| `type`   | Contoh `url`                                   | Klik peta                       |
|----------|------------------------------------------------|---------------------------------|
| `wms`    | `https://…/geoserver/wms` + `layers`           | WMS GetFeatureInfo (JSON)       |
| `arcgis` | `https://…/arcgis/rest/services/…/MapServer`   | ArcGIS `/identify`              |
| `xyz`    | `https://…/{z}/{x}/{y}.png`                    | `identifyUrl` (opsional)        |
| `mvt`    | `https://…/{z}/{x}/{y}.pbf`                    | atribut tile + `detailUrl`      |
| `file`   | GeoJSON / SHP `.zip` / KML (path repo, URL, link Google Drive) | atribut dari file |

Mengarahkan ke **BHUMI**: isi `url` pada sumber `bhumi` dengan endpoint WMS/ArcGIS resmi dari Pusdatin ATR/BPN.
Layanan persil di situs BHUMI saat ini berada di balik proxy bertoken (tanpa token: HTTP 403), jadi perlu akses resmi,
termasuk izin CORS untuk domain Bale Ruang NTB agar klik info persil berfungsi.

Mengarahkan ke **BumiAtlas**: isi `url` (vector tile `.pbf`) dan bila ada `detailUrl` pada sumber `bumiatlas`.
Data BumiAtlas tidak berlisensi terbuka; gunakan hanya dengan izin tertulis dari pengelolanya.

Untuk uji cepat tanpa mengubah kode, pilih **URL layanan sendiri** di panel layer (tersimpan hanya di browser itu).

### Persil dari file manual (GeoJSON, SHP, KML)

**Paling mudah — unggah dari komputer:** di bagian *Persil / bidang tanah*, tekan tombol unggah (ikon panah atas),
lalu pilih file `.geojson`, `.zip` (berisi `.shp`, `.shx`, `.dbf`, `.prj`) atau `.kml`. File dibaca di browser itu saja,
tidak dikirim ke server mana pun, dan perlu diunggah ulang setiap kali halaman dibuka.
SHP dalam TM-3/UTM otomatis diubah ke WGS84 selama file `.prj` ikut di dalam zip; GeoJSON harus sudah dalam derajat (EPSG:4326).

**Agar tampil untuk semua pengguna — simpan di repo:** taruh file di `data/persil/` (mis. `data/persil/persil-selong.geojson`),
lalu isi `url` pada sumber `file` di `js/persil-config.js` dengan path itu. Karena satu domain dengan web, tidak ada masalah CORS.
Perhatikan: repo dan GitHub Pages ini publik, jadi atribut seperti NIB dan nama pemegang hak ikut terbuka untuk umum.
Buang kolom data pribadi sebelum mengunggah.

**Link Google Drive:** link berbagi (`https://drive.google.com/file/d/<ID>/view`) otomatis diubah menjadi link unduh
`https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t`. Syaratnya file dibagikan
"Siapa saja yang memiliki link". Namun Google sering menolak unduhan langsung dari web lain (CORS), sehingga cara ini
tidak bisa diandalkan; bila muncul pesan "Google Drive menolak…", gunakan unggah dari komputer atau simpan di repo.

Semua bidang dari file dimuat sekaligus dan digambar mulai zoom 14, jadi pakai per desa/kecamatan (puluhan ribu bidang masih wajar).
