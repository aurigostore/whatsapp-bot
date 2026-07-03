// ============================================================
//  handlers/user.js - Handler Perintah Semua User
//  Perintah: list, [nama produk], pay/payment, rules, cara order
// ============================================================

import {
  sendText,
  sendImage,
  sendTextMention,
  isOwner,
  log,
  logError,
} from "../lib/utils.js";
import {
  getProducts,
  getProduct,
  getPayment,
  getSettings,
  isNotifOwnerOn,
} from "../lib/db.js";
import config from "../config.js";

// ── Helper: kirim notif ke owner ─────────────────────────
async function notifOwner(sock, info, konteks) {
  try {
    // Cek apakah fitur notif aktif
    if (!isNotifOwnerOn()) return;
    // Jangan notif kalau yang nanya adalah owner sendiri
    if (isOwner(info.sender)) return;

    const ownerJid = `${config.OWNER[0].replace(/\D/g, "")}@s.whatsapp.net`;
    const nomorUser = info.sender?.split("@")[0] || "unknown";
    const nama = info.pushName || nomorUser;

    let namaGrup = "-";
    if (info.isGroup) {
      try {
        const meta = await sock.groupMetadata(info.remoteJid);
        namaGrup = meta?.subject || info.remoteJid;
      } catch {}
    }

    const pesan =
      `🔔 *NOTIFIKASI AKTIVITAS*\n` +
      `👤 User   : ${nama} (${nomorUser})\n` +
      `📂 Grup   : ${namaGrup}\n` +
      `💬 Aksi   : ${konteks}`;

    await sock.sendMessage(ownerJid, { text: pesan });
  } catch {}
}

export async function handleUser(sock, info) {
  const { remoteJid, command, fullText, message, sender, isQuoted, quotedMsg } = info;
  const cmd = command?.toLowerCase()?.trim();
  const txt = fullText?.toLowerCase()?.trim();

  // ── 1. LIST PRODUK ─────────────────────────────────────
  if (txt === "list") {
    const products = getProducts();
    const daftar = Object.values(products);
    const settings = getSettings();

    if (daftar.length === 0) {
      return await sendText(
        sock,
        remoteJid,
        "📦 *Belum ada produk tersedia.*\n\nAdmin silakan tambahkan produk dengan perintah:\n*.addlist nama produk | deskripsi*",
        message
      );
    }

    // Ambil nama grup
    let namaGrup = remoteJid;
    if (info.isGroup) {
      try {
        const meta = await sock.groupMetadata(remoteJid);
        namaGrup = meta?.subject || remoteJid;
      } catch {}
    }

    // Format tanggal & jam WIB
    const now = new Date();
    const opsi = { timeZone: "Asia/Jakarta" };
    const jam = now.toLocaleTimeString("id-ID", { ...opsi, hour12: false });
    const tanggal = now.toLocaleDateString("id-ID", {
      ...opsi,
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Urut abjad
    const sorted = daftar.sort((a, b) =>
      a.nama.toLowerCase().localeCompare(b.nama.toLowerCase())
    );

    const nomorUser = sender?.split("@")[0] || "";

    let pesan = `Halo @${nomorUser} ☺️\n`;
    pesan += `Selamat Datang di grub ${namaGrup}\n`;
    pesan += `📆 Tanggal : ${tanggal}\n`;
    pesan += `⏰ Jam     : ${jam} WIB\n\n`;
    pesan += `*PRICELIST APLIKASI*\n`;
    pesan += `${"=".repeat(20)}\n`;
    sorted.forEach((p) => {
      pesan += `✅  ${p.nama.toUpperCase()}\n`;
    });
    pesan += `${"=".repeat(20)}\n`;
    pesan += `Untuk melihat detail produk,\n`;
    pesan += `Ketik nama produk di atas`;

    // Kirim dengan banner jika ada, tanpa banner jika tidak ada
    if (settings.listBanner) {
      const buffer = Buffer.from(settings.listBanner, "base64");
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: pesan,
        mentions: [sender],
      }, { quoted: message });
    } else {
      await sock.sendMessage(remoteJid, {
        text: pesan,
        mentions: [sender],
      }, { quoted: message });
    }
    return;
  }

  // ── 2. PAYMENT / PAY ───────────────────────────────────
  if (txt === "pay" || txt === "payment") {
    const pay = getPayment();

    if (!pay.gambar && (!pay.keterangan || pay.keterangan.trim() === "")) {
      return await sendText(
        sock,
        remoteJid,
        "💳 *Informasi pembayaran belum diatur.*\n\nAdmin silakan set dengan:\n*.setpay | keterangan* (sambil kirim gambar QRIS)",
        message
      );
    }

    // Tentukan target mention: yang mereply atau pengirim sendiri
    const targetJid = (isQuoted && quotedMsg?.sender) ? quotedMsg.sender : sender;
    const nomorTarget = targetJid?.split("@")[0] || "";

    // Ganti placeholder @user di keterangan
    const keteranganFinal = (pay.keterangan || "").replace(/@user/gi, `@${nomorTarget}`);
    const hasUserMention = /@user/i.test(pay.keterangan || "");
    const mentions = hasUserMention && targetJid ? [targetJid] : [];

    if (pay.gambar) {
      const buffer = Buffer.from(pay.gambar, "base64");
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: keteranganFinal,
        mentions,
      }, { quoted: message });
    } else {
      await sock.sendMessage(remoteJid, {
        text: keteranganFinal,
        mentions,
      }, { quoted: message });
    }

    // Notif owner
    await notifOwner(sock, info, "Melihat info payment 💳");
    return;
  }

  // ── 3. RULES ──────────────────────────────────────────
  if (txt === "rules") {
    const settings = getSettings();

    if (!settings.rules || settings.rules.trim() === "") {
      return await sendText(
        sock,
        remoteJid,
        "📜 *Belum ada rules grup.*\n\nAdmin silakan set dengan:\n*.setrules | isi rules*",
        message
      );
    }

    return await sendText(sock, remoteJid, settings.rules, message);
  }

  // ── 4. CARA ORDER ─────────────────────────────────────
  if (txt === "cara order") {
    const settings = getSettings();

    if (!settings.caraOrder && !settings.caraOrderGambar) {
      return await sendText(
        sock,
        remoteJid,
        "📋 *Cara order belum diatur.*\n\nAdmin silakan set dengan:\n*.setcaraorder | teks cara order* (bisa sambil kirim gambar)",
        message
      );
    }

    const teks = settings.caraOrder || "";

    if (settings.caraOrderGambar) {
      const buffer = Buffer.from(settings.caraOrderGambar, "base64");
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: teks,
      }, { quoted: message });
    } else {
      await sendText(sock, remoteJid, teks, message);
    }
    return;
  }

  // ── 5. NAMA PRODUK → DETAIL PRODUK ─────────────────────
  // Coba cocokkan teks dengan nama produk yang ada
  if (!info.prefix) {
    // Hanya proses jika bukan perintah admin (tidak ada prefix)
    const produk = getProduct(txt);
    if (produk) {
      await sendText(sock, remoteJid, produk.deskripsi, message);
      // Notif owner
      await notifOwner(sock, info, `Melihat produk *${produk.nama}* 🛍️`);
      return;
    }
  }

  // Tidak ada yang cocok → tidak balas
  return false;
}
