// ============================================================
//  config.js - Konfigurasi Bot WhatsApp
//  Ubah sesuai kebutuhan Anda
// ============================================================

const config = {
  // Nomor WhatsApp bot (format internasional tanpa + dan tanpa spasi)
  // Contoh: "6281234567890"
  NOMOR_BOT: "6285608422153",

  // Daftar nomor owner / super-admin bot
  // Bisa lebih dari satu nomor
  OWNER: ["6285158110858"],

  // Mode koneksi: "pairing" atau "qr"
  // "pairing" = ketik pairing code di aplikasi WhatsApp
  // "qr"      = scan QR code di terminal
  KONEKSI: "pairing",

  // Prefix untuk perintah admin
  PREFIX: ".",

  // Timezone
  TIMEZONE: "Asia/Jakarta",

  // Rate limit antar pesan (ms) - untuk mencegah spam balasan
  RATE_LIMIT: 2000,

  // Inisial toko untuk kode transaksi (2-3 huruf)
  // Contoh: "AS" → kode transaksi: AS020726-G5FT6
  INISIAL_TOKO: "AS",

  // ID Grup Notifikasi Transaksi
  // Cara mendapatkan ID grup: lihat di log terminal saat ada pesan masuk dari grup tersebut
  // Format: "120363xxxxxxxxxx@g.us"
  // Kosongkan ("") jika tidak ingin menggunakan fitur notif grup
  GRUP_NOTIF: "120363409865391346@g.us"
};

export default config;
