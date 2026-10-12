# APK Android Bale Ruang NTB (Trusted Web Activity)

APK ini hanya "penampil": membuka https://atrbpnproject.github.io/baleruangntb/ layar penuh memakai Chrome.
Pembaruan situs otomatis ikut; APK baru hanya perlu dibuat bila nama/ikon/alamat berubah.

## Membuat versi baru
1. Ubah `versionCode` (+1) dan `versionName` di `app/build.gradle` (dan ikon di `app/src/main/res/` bila perlu), lalu push ke `main`.
2. GitHub Actions (`.github/workflows/android-apk.yml`) membangun APK **belum ditandatangani** ke branch `apk-build`.
3. Tandatangani dengan kunci rilis (disimpan di luar repo, folder `KUNCI-RAHASIA-JANGAN-DIBAGIKAN`), mis. memakai
   uber-apk-signer: `java -jar uber-apk-signer.jar --apks bale-ruang-ntb-unsigned.apk --ks bale-ruang-ntb-release.jks --ksAlias baleruang`
   Selalu pakai kunci yang SAMA agar APK bisa memperbarui versi lama.

## Verifikasi layar penuh
`https://atrbpnproject.github.io/.well-known/assetlinks.json` (repo `atrbpnproject.github.io`) harus memuat paket
`io.github.atrbpnproject.baleruang` dan sidik jari SHA-256 kunci rilis.
