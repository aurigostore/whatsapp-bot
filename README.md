# WhatsApp Bot

Bot WhatsApp sederhana untuk manajemen produk dan grup.

## 📋 Fitur

### Perintah User (Semua Orang)
| Perintah | Fungsi |
|---|---|
| `list` | Lihat daftar produk tersedia |
| `[nama produk]` | Lihat detail & harga produk |
| `pay` / `payment` | Lihat QRIS & info pembayaran |
| `rules` | Lihat rules grup |

### Perintah Admin
| Perintah | Fungsi |
|---|---|
| `.addlist nama \| deskripsi` | Tambah produk |
| `.editlist nama \| deskripsi baru` | Edit produk |
| `.deletelist nama` | Hapus produk |
| `.setpay \| keterangan` *(+ gambar QRIS)* | Set info pembayaran |
| `.setrules \| isi rules` | Set rules grup |
| `.setwelcome \| pesan` *(+ gambar opsional)* | Set pesan welcome |
| `.kick 628xxx` atau reply → `.kick` | Kick member |
| `.addmember 628xxx` | Tambah member |
| `.addadmin 628xxx` atau reply → `.addadmin` | Jadikan admin |
| `.removeadmin 628xxx` atau reply → `.removeadmin` | Turunkan admin |
| `.close` | Tutup grup (hanya admin bisa chat) |
| `.open` | Buka grup |
| `.hidetag pesan` | Tag semua member |
| Reply pesan → `.proses` | Kirim notif sedang diproses |
| Reply pesan → `.done` | Kirim notif transaksi berhasil |

## 🚀 Cara Menjalankan

### 1. Install dependencies
```bash
npm install
```

### 2. Konfigurasi
Edit file `config.js`:
```js
NOMOR_BOT: "628xxx",    // Nomor WhatsApp bot
OWNER: ["628xxx"],       // Nomor owner/super-admin
KONEKSI: "pairing",      // "pairing" atau "qr"
```

### 3. Jalankan bot
```bash
npm start
```

### 4. Hubungkan WhatsApp
- **Pairing Code**: Salin kode yang muncul di terminal → buka WhatsApp → Perangkat Tertaut → Tautkan dengan Nomor Telepon → masukkan kode
- **QR Code**: Scan QR yang muncul di terminal

## 📁 Struktur File
```
WHATSAPP BOT/
├── index.js              # Entry point
├── config.js             # Konfigurasi
├── lib/
│   ├── connection.js     # Koneksi Baileys
│   ├── message.js        # Parse pesan masuk
│   ├── db.js             # Database manager
│   └── utils.js          # Helper functions
├── database/
│   ├── products.json     # Data produk
│   ├── payment.json      # Data QRIS
│   ├── settings.json     # Rules & welcome
│   └── admins.json       # Daftar admin bot
├── handlers/
│   ├── user.js           # Perintah semua user
│   ├── admin.js          # Perintah admin
│   └── welcome.js        # Welcome member baru
└── session/              # Sesi WhatsApp (auto-created)
```

## 📝 Catatan
- Placeholder welcome: `@user` (mention user), `@grup` (nama grup)
- Hak admin: owner di config.js + admin WhatsApp grup
- Semua data tersimpan di folder `database/`
