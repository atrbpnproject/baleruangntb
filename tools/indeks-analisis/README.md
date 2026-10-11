# Indeks Analisis Bale Ruang NTB

Alat ini membangun ulang paket data analisis (format v2) dan indeks titik (`pidx`).
Jalankan setiap kali data layer di `data/analysis/` atau batas desa di `data/admin-index/` diperbarui.
Butuh Node.js 18+. Tidak ada geometri yang disederhanakan, dibulatkan, atau dipotong pada data sumber.

## Apa yang dibangun

- `data/analysis/<layer>/packs/` — fitur kecil dikelompokkan per sub-grid 0,02°; setiap fitur besar (>100 KB) satu berkas `g<n>.js.gz`.
- `data/analysis/<layer>/cells/` — daftar paket per sel 0,1° (dipakai tampilan peta, cetak, analisis poligon).
- `data/analysis/<layer>/pidx/` — indeks titik: bbox fitur kecil + potongan uji fitur besar per sub-grid (hanya untuk uji titik-dalam-poligon; tampilan & atribut tetap memakai fitur sumber utuh).
- `data/admin-index/pidx/` — indeks titik batas desa (desa >300 KB diuji lewat potongan).

## Perintah (dari folder repo)

```
# 1. Paket + indeks layer (salin dulu data/analysis ke folder sementara sebagai sumber)
node --max-old-space-size=6000 tools/indeks-analisis/build-v2.js SUMBER/analysis data/analysis all

# 2. Indeks batas desa
node --max-old-space-size=6000 tools/indeks-analisis/build-admin-pidx.js data/admin-index data/admin-index 300000
#    lalu buat data/admin-index/pidx/cells.json (daftar sel, lihat catatan di bawah)

# 3. Verifikasi (wajib): hasil harus "SEMUA LAYER LOLOS" / "beda":0
node --max-old-space-size=6800 tools/indeks-analisis/validate-v2.js SUMBER/analysis data/analysis 3000 tools/indeks-analisis/legacy.json <kunci-layer>
node --max-old-space-size=6500 tools/indeks-analisis/validate-admin.js data/admin-index 30000
```

Setelah membangun ulang, naikkan `ANALYSIS_DATA_VERSION` di `index.html` dan `PIDX_VERSION` di `js/admin-lookup.js`
agar browser pengguna tidak memakai berkas lama dari cache.

Catatan `cells.json`: berisi array JSON nama sel (mis. `["1158:-88", ...]`) dari setiap berkas `data/admin-index/pidx/<x>_m<y>.json.gz`.
