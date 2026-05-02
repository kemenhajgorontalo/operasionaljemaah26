# Audit Data Sumber

Repository sumber:
`/content/drive/MyDrive/RICHIE/ASRAMAHAJI/datajemaahgorontalo2026`

## Ringkasan

- Total jemaah seed: 611
- Kloter 28: 393 jemaah
- Kloter 30: 218 jemaah
- Total kombinasi kamar/hotel/lantai: 213
- Data JSON utama:
  - `public/data/kloter-28.json`
  - `public/data/kloter-30.json`
  - `public/data/penempatan-jemaah-gorontalo.json`
  - `public/data/site.json`
- CSV mentah:
  - `totalpelunasan - Sheet1.csv`

## Field Jemaah Tersedia

- `id`
- `noPorsi`
- `nama`
- `kloterCode`
- `kloterLabel`
- `rombongan`
- `reguKloter`
- `statusJemaah`
- `kabKota`
- `jenisKelamin`
- `umur`
- `noPaspor`
- `noVisa`
- `noHp`
- `namaDesa`
- `accommodation.namaHotel`
- `accommodation.lantai`
- `accommodation.nomorKamar`
- `accommodation.posisiBed`
- `assets.foto`
- `assets.kartu`
- `assets.visa`

## Aset Sumber

Ukuran aset sumber sekitar 306 MB.

Kelengkapan aset berdasarkan seed:

- Foto: 604 tersedia, 7 tidak tersedia
- Kartu PDF: 604 tersedia, 7 tidak tersedia
- Visa PDF: 601 tersedia, 10 tidak tersedia

Aset lama tidak langsung disalin ke proyek baru agar repo operasional tetap ringan. Path sumber tetap dicatat di `sourceAssets` pada `pilgrims.json`.

## Distribusi Akomodasi Asrama

Kloter 28:

- 393 jemaah
- Hotel El Madina: 352
- Hotel Jabal Uhud: 41
- Lantai 1: 152
- Lantai 2: 127
- Lantai 3: 114

Kloter 30:

- 218 jemaah
- Hotel El Madina: 218
- Lantai 1: 120
- Lantai 2: 97
- Lantai 3: 1

## Keputusan Desain Data Operasional

Data master jemaah disimpan sebagai seed lokal `pilgrims.json`.

Data transaksi baru masuk ke Firestore:

- `handover_records` untuk living cost, kartu akomodasi, gelang, koper
- `room_deliveries` untuk dokumentasi distribusi koper per kamar
- `lost_found` untuk barang temuan/hilang
- `gallery_photos` untuk galeri umum kegiatan

Foto baru disimpan ke Cloudinary dan metadata URL/public ID-nya masuk ke Firestore.
