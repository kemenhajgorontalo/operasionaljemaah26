# Operasional Jemaah Gorontalo 2026

Aplikasi operasional untuk dokumentasi dan pendataan layanan jemaah haji Gorontalo Kloter 28 dan Kloter 30.

Fokus aplikasi:
- tanda terima living cost
- penerimaan kartu akomodasi
- penerimaan gelang
- penerimaan koper
- foto distribusi koper per kamar
- lost and found
- galeri foto kegiatan

Data master jemaah dan kamar diambil dari repository sumber:
`kemenhajgorontalo/datajemaahgorontalo2026`

## Struktur

- `public/index.html` - aplikasi utama
- `public/app.js` - logika pencarian, form, Firebase, Cloudinary
- `public/config.js` - konfigurasi Firebase dan Cloudinary
- `public/data/pilgrims.json` - seed data jemaah
- `public/data/rooms.json` - seed data kamar
- `public/data/seed-summary.json` - ringkasan hasil import
- `scripts/build_seed_data.js` - generator seed dari repo sumber
- `docs/DATA_AUDIT.md` - catatan audit data sumber

## Database Firestore

Collection operasional yang disiapkan:

- `handover_records`
- `room_deliveries`
- `lost_found`
- `gallery_photos`

Jika Firebase belum dikonfigurasi, aplikasi tetap bisa dipakai dalam mode lokal. Record akan tersimpan sementara di `localStorage` perangkat.

## Cloudinary

Isi `public/config.js` dengan `CLOUD_NAME`, `UPLOAD_PRESET`, dan `FOLDER`.

Upload preset harus bertipe unsigned agar bisa dipakai langsung dari static web app.

## Audit Mobile dan Penyimpanan

- Aplikasi dirancang mobile-first dan kamera dipanggil dengan `getUserMedia`, sehingga harus dibuka dari HTTPS pada Android/iOS. Preview Cloudflare Tunnel sudah memenuhi syarat HTTPS.
- Kamera meminta kamera belakang lebih dulu. Setelah izin kamera diberikan, aplikasi membaca daftar kamera perangkat, berpindah otomatis jika kamera depan yang aktif, dan menyediakan tombol `Ganti Kamera` sebagai mitigasi perangkat yang salah memilih kamera.
- Foto bukti selalu dibuat dari kamera aplikasi, diberi watermark di canvas, lalu diupload ke Cloudinary sebelum record dikirim ke Firestore.
- Jika Cloudinary belum aktif atau gagal dikonfigurasi, record disimpan lokal di perangkat dan tidak dikirim ke Firestore untuk menghindari penyimpanan base64 foto besar di database.
- Firestore hanya menerima record operasional dengan `photoUrl` Cloudinary dan metadata watermark.

## Menjalankan Lokal

```bash
cd /content/drive/MyDrive/RICHIE/ASRAMAHAJI/operasional-jemaah-gorontalo2026/public
python3 -m http.server 8091
```

Buka:

```text
http://127.0.0.1:8091
```

## Regenerate Seed Data

```bash
node scripts/build_seed_data.js /content/drive/MyDrive/RICHIE/ASRAMAHAJI/datajemaahgorontalo2026
```
