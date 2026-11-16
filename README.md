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

Mengarahkan ke **BHUMI**: isi `url` pada sumber `bhumi` dengan endpoint WMS/ArcGIS resmi dari Pusdatin ATR/BPN.
Layanan persil di situs BHUMI saat ini berada di balik proxy bertoken (tanpa token: HTTP 403), jadi perlu akses resmi,
termasuk izin CORS untuk domain Bale Ruang NTB agar klik info persil berfungsi.

Mengarahkan ke **BumiAtlas**: isi `url` (vector tile `.pbf`) dan bila ada `detailUrl` pada sumber `bumiatlas`.
Data BumiAtlas tidak berlisensi terbuka; gunakan hanya dengan izin tertulis dari pengelolanya.

Untuk uji cepat tanpa mengubah kode, pilih **URL layanan sendiri** di panel layer (tersimpan hanya di browser itu).
