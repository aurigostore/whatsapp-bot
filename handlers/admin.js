// ============================================================
//  handlers/admin.js - Handler Perintah Admin
// ============================================================

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  sendText,
  sendImage,
  sendTextMention,
  getGroupMeta,
  isOwner,
  isGroupAdmin,
  toJid,
  getTime,
  getDate,
  log,
  logError,
} from "../lib/utils.js";

import { getLidInfo } from "../lib/message.js";

import {
  getAdmins,
  addProduct,
  editProduct,
  deleteProduct,
  setPayment,
  setRules,
  setWelcome,
  setCaraOrder,
  setListBanner,
  removeListBanner,
  setNotifOwner,
  isNotifOwnerOn,
  savePendingTransaction,
  getPendingTransaction,
  deletePendingTransaction,
  getProducts,
  getPayment,
} from "../lib/db.js";

import config from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, "../tmp");

// ── Pastikan folder tmp ada ───────────────────────────────
try {
  await fs.mkdir(TMP_DIR, { recursive: true });
} catch { }

// ── Helper: cek apakah sender boleh pakai perintah admin ─
async function cekAdmin(sock, info) {
  const { sender, remoteJid, isGroup } = info;
  if (isOwner(sender)) return true;
  const adminBot = getAdmins();
  const nomorSender = sender.replace(/\D/g, "");
  if (adminBot.includes(nomorSender)) return true;
  if (isGroup) {
    const meta = await getGroupMeta(sock, remoteJid);
    if (meta) {
      const adlAdmin = isGroupAdmin(meta.participants, sender);
      if (adlAdmin) return true;
    }
  }
  return false;
}

// ── Helper: download media dari pesan ────────────────────
async function downloadMedia(sock, info) {
  try {
    const { downloadMediaMessage } = await import("baileys");
    const buffer = await downloadMediaMessage(
      info.message,
      "buffer",
      {},
      { logger: { info: () => { }, error: () => { } }, reuploadRequest: sock.updateMediaMessage }
    );
    return buffer;
  } catch (err) {
    logError("downloadMedia", err.message);
    return null;
  }
}

// ── Helper: resolve info user dari JID (handle LID) ──────
async function resolveUser(sock, groupJid, senderJid, fallbackPushName = "") {
  // Coba dari LID cache dulu (diisi setiap ada pesan masuk dari user)
  const cached = getLidInfo(senderJid);
  if (cached?.pushName) {
    return {
      nomorUser: senderJid.split("@")[0],
      namaUser: cached.pushName,
      userJidResolved: senderJid,
    };
  }

  // Jika ada fallbackPushName dari quotedMsg.pushName
  if (fallbackPushName) {
    return {
      nomorUser: senderJid.split("@")[0],
      namaUser: fallbackPushName,
      userJidResolved: senderJid,
    };
  }

  // Fallback: coba resolve dari metadata grup
  let nomorUser = senderJid.split("@")[0];
  let namaUser = "";
  let userJidResolved = senderJid;

  try {
    const meta = await getGroupMeta(sock, groupJid);
    if (meta?.participants) {
      const senderBase = senderJid.split("@")[0];
      const p = meta.participants.find((x) => {
        const idBase = x.id?.split("@")[0];
        const lidBase = x.lidJid?.split("@")[0];
        return idBase === senderBase || lidBase === senderBase;
      });
      if (p) {
        if (p.id?.endsWith("@s.whatsapp.net")) { userJidResolved = p.id; nomorUser = p.id.split("@")[0]; }
        else if (p.lidJid?.endsWith("@s.whatsapp.net")) { userJidResolved = p.lidJid; nomorUser = p.lidJid.split("@")[0]; }
        namaUser = p.notify || p.verifiedName || "";
      }
    }
  } catch { }

  if (!namaUser) namaUser = nomorUser;
  return { nomorUser, namaUser, userJidResolved };
}

// ── Helper: format nomor — sembunyikan jika masih LID ────
function formatNomor(nomor) {
  // Nomor valid Indonesia diawali 62 dan panjang 10-15 digit
  if (/^62\d{8,13}$/.test(nomor)) return nomor;
  // LID atau format tidak dikenal → tidak ditampilkan
  return "(tidak tersedia)";
}

// ── MAIN HANDLER ─────────────────────────────────────────
export async function handleAdmin(sock, info) {
  const { remoteJid, command, body, args, prefix, message, isQuoted, quotedMsg, sender } = info;

  // Hanya proses jika ada prefix
  if (!prefix) return false;

  // Cek izin admin
  const boleh = await cekAdmin(sock, info);
  if (!boleh) {
    return await sendText(sock, remoteJid, "⛔ *Perintah ini hanya untuk admin!*", message);
  }

  // ── .addlist nama produk | Deskripsi ─────────────────
  if (command === "addlist") {
    if (!body || !body.includes("|")) {
      return await sendText(sock, remoteJid, "❌ Format salah!\n\n*Contoh:*\n.addlist Paket A | Deskripsi produk dan harga", message);
    }
    const [nama, ...desParts] = body.split("|");
    const deskripsi = desParts.join("|").trim();
    if (!nama.trim() || !deskripsi) {
      return await sendText(sock, remoteJid, "❌ Nama dan deskripsi tidak boleh kosong!", message);
    }
    const berhasil = addProduct(nama.trim(), deskripsi);
    if (!berhasil) {
      return await sendText(sock, remoteJid, `❌ Produk *${nama.trim()}* sudah ada!\nGunakan *.editlist* untuk mengedit.`, message);
    }
    return await sendText(sock, remoteJid, `✅ Produk *${nama.trim()}* berhasil ditambahkan!`, message);
  }

  // ── .editlist nama produk | Deskripsi baru ───────────
  if (command === "editlist") {
    if (!body || !body.includes("|")) {
      return await sendText(sock, remoteJid, "❌ Format salah!\n\n*Contoh:*\n.editlist Paket A | Deskripsi baru", message);
    }
    const [nama, ...desParts] = body.split("|");
    const deskripsi = desParts.join("|").trim();
    const berhasil = editProduct(nama.trim(), deskripsi);
    if (!berhasil) {
      return await sendText(sock, remoteJid, `❌ Produk *${nama.trim()}* tidak ditemukan!`, message);
    }
    return await sendText(sock, remoteJid, `✅ Produk *${nama.trim()}* berhasil diupdate!`, message);
  }

  // ── .deletelist nama produk ───────────────────────────
  if (command === "deletelist") {
    const nama = body.trim();
    if (!nama) return await sendText(sock, remoteJid, "❌ Format: *.deletelist nama produk*", message);
    const berhasil = deleteProduct(nama);
    if (!berhasil) return await sendText(sock, remoteJid, `❌ Produk *${nama}* tidak ditemukan!`, message);
    return await sendText(sock, remoteJid, `✅ Produk *${nama}* berhasil dihapus!`, message);
  }

  // ── .setpay | keterangan (+ gambar) ──────────────────
  if (command === "setpay") {
    let keterangan = body.startsWith("|") ? body.slice(1).trim() : body.trim();
    let gambarBase64 = null;
    if (info.type === "imageMessage") {
      const buffer = await downloadMedia(sock, info);
      if (buffer) gambarBase64 = buffer.toString("base64");
    }
    if (!keterangan && gambarBase64 === null) {
      return await sendText(sock, remoteJid, "❌ Format: *.setpay | keterangan*\n(Kirim bersama gambar QRIS untuk mengupdate gambar)", message);
    }
    setPayment(keterangan || getPayment().keterangan, gambarBase64);
    return await sendText(sock, remoteJid, "✅ Informasi pembayaran berhasil diupdate!", message);
  }

  // ── .setrules | isi rules ─────────────────────────────
  if (command === "setrules") {
    const rules = body.startsWith("|") ? body.slice(1).trim() : body.trim();
    if (!rules) return await sendText(sock, remoteJid, "❌ Format: *.setrules | isi rules grup*", message);
    setRules(rules);
    return await sendText(sock, remoteJid, "✅ Rules grup berhasil diupdate!", message);
  }

  // ── .setwelcome | pesan sapaan (+ gambar opsional) ───
  if (command === "setwelcome") {
    const welcome = body.startsWith("|") ? body.slice(1).trim() : body.trim();
    let gambarBase64 = null;
    if (info.type === "imageMessage") {
      const buffer = await downloadMedia(sock, info);
      if (buffer) gambarBase64 = buffer.toString("base64");
    }
    if (!welcome) {
      return await sendText(sock, remoteJid, "❌ Format: *.setwelcome | pesan sapaan*\n\nPlaceholder:\n@user → mention user baru\n@grup → nama grup", message);
    }
    setWelcome(welcome, gambarBase64);
    return await sendText(sock, remoteJid, "✅ Pesan welcome berhasil diupdate!", message);
  }

  // ── .setcaraorder | teks (+ gambar opsional) ─────────
  if (command === "setcaraorder") {
    const teks = body.startsWith("|") ? body.slice(1).trim() : body.trim();
    let gambarBase64 = null;
    if (info.type === "imageMessage") {
      const buffer = await downloadMedia(sock, info);
      if (buffer) gambarBase64 = buffer.toString("base64");
    }
    if (!teks && gambarBase64 === null) {
      return await sendText(sock, remoteJid, "❌ Format: *.setcaraorder | teks cara order*\n(Bisa sambil kirim gambar)", message);
    }
    setCaraOrder(teks, gambarBase64);
    return await sendText(sock, remoteJid, "✅ Cara order berhasil diupdate!", message);
  }

  // ── .setbanner (kirim gambar) ─────────────────────────
  if (command === "setbanner") {
    if (info.type !== "imageMessage") {
      return await sendText(sock, remoteJid, "❌ Kirim gambar banner sambil ketik *.setbanner*\nGambar ini akan muncul di atas pesan list.", message);
    }
    const buffer = await downloadMedia(sock, info);
    if (!buffer) return await sendText(sock, remoteJid, "❌ Gagal mengunduh gambar.", message);
    setListBanner(buffer.toString("base64"));
    return await sendText(sock, remoteJid, "✅ Banner list berhasil diupdate!", message);
  }

  // ── .removebanner ─────────────────────────────────────
  if (command === "removebanner") {
    removeListBanner();
    return await sendText(sock, remoteJid, "✅ Banner list berhasil dihapus!", message);
  }

  // ── .notifon / .notifoff ──────────────────────────────
  if (command === "notifon") {
    setNotifOwner(true);
    return await sendText(sock, remoteJid, "✅ Notifikasi aktivitas user ke owner *diaktifkan*!", message);
  }
  if (command === "notifoff") {
    setNotifOwner(false);
    return await sendText(sock, remoteJid, "🔕 Notifikasi aktivitas user ke owner *dinonaktifkan*!", message);
  }

  // ── .kick ─────────────────────────────────────────────
  if (command === "kick") {
    if (!info.isGroup) return await sendText(sock, remoteJid, "❌ Perintah ini hanya di grup!", message);
    let targetJid = null;
    if (isQuoted && quotedMsg?.sender) targetJid = quotedMsg.sender;
    else if (body.trim()) targetJid = toJid(body.trim());
    else if (args[0]) targetJid = toJid(args[0]);
    if (!targetJid) return await sendText(sock, remoteJid, "❌ Format:\n*.kick 628xxx* atau reply pesan lalu ketik *.kick*", message);
    try {
      await sock.groupParticipantsUpdate(remoteJid, [targetJid], "remove");
      return await sendText(sock, remoteJid, `✅ Member *${targetJid.split("@")[0]}* berhasil dikick!`, message);
    } catch (err) {
      return await sendText(sock, remoteJid, `❌ Gagal kick: ${err.message}`, message);
    }
  }

  // ── .addmember ────────────────────────────────────────
  if (command === "addmember") {
    if (!info.isGroup) return await sendText(sock, remoteJid, "❌ Perintah ini hanya di grup!", message);
    const nomor = body.trim() || args[0];
    if (!nomor) return await sendText(sock, remoteJid, "❌ Format: *.addmember 628xxx*", message);
    try {
      const targetJid = toJid(nomor);
      await sock.groupParticipantsUpdate(remoteJid, [targetJid], "add");
      return await sendText(sock, remoteJid, `✅ Member *${targetJid.split("@")[0]}* berhasil ditambahkan!`, message);
    } catch (err) {
      return await sendText(sock, remoteJid, `❌ Gagal add member: ${err.message}`, message);
    }
  }

  // ── .addadmin ─────────────────────────────────────────
  if (command === "addadmin") {
    if (!info.isGroup) return await sendText(sock, remoteJid, "❌ Perintah ini hanya di grup!", message);
    let targetJid = null;
    if (isQuoted && quotedMsg?.sender) targetJid = quotedMsg.sender;
    else { const nomor = body.trim() || args[0]; if (nomor) targetJid = toJid(nomor); }
    if (!targetJid) return await sendText(sock, remoteJid, "❌ Format:\n*.addadmin 628xxx* atau reply pesan lalu ketik *.addadmin*", message);
    try {
      await sock.groupParticipantsUpdate(remoteJid, [targetJid], "promote");
      return await sendText(sock, remoteJid, `✅ *${targetJid.split("@")[0]}* berhasil dijadikan admin!`, message);
    } catch (err) {
      return await sendText(sock, remoteJid, `❌ Gagal promote: ${err.message}`, message);
    }
  }

  // ── .removeadmin ──────────────────────────────────────
  if (command === "removeadmin") {
    if (!info.isGroup) return await sendText(sock, remoteJid, "❌ Perintah ini hanya di grup!", message);
    let targetJid = null;
    if (isQuoted && quotedMsg?.sender) targetJid = quotedMsg.sender;
    else { const nomor = body.trim() || args[0]; if (nomor) targetJid = toJid(nomor); }
    if (!targetJid) return await sendText(sock, remoteJid, "❌ Format:\n*.removeadmin 628xxx* atau reply pesan lalu ketik *.removeadmin*", message);
    try {
      await sock.groupParticipantsUpdate(remoteJid, [targetJid], "demote");
      return await sendText(sock, remoteJid, `✅ *${targetJid.split("@")[0]}* berhasil diturunkan dari admin!`, message);
    } catch (err) {
      return await sendText(sock, remoteJid, `❌ Gagal demote: ${err.message}`, message);
    }
  }

  // ── .close ────────────────────────────────────────────
  if (command === "close") {
    if (!info.isGroup) return await sendText(sock, remoteJid, "❌ Perintah ini hanya di grup!", message);
    try {
      await sock.groupSettingUpdate(remoteJid, "announcement");
      return await sendText(sock, remoteJid, "🔒 *Grup telah ditutup!*\nHanya admin yang bisa mengirim pesan.", message);
    } catch (err) {
      return await sendText(sock, remoteJid, `❌ Gagal menutup grup: ${err.message}`, message);
    }
  }

  // ── .open ─────────────────────────────────────────────
  if (command === "open") {
    if (!info.isGroup) return await sendText(sock, remoteJid, "❌ Perintah ini hanya di grup!", message);
    try {
      await sock.groupSettingUpdate(remoteJid, "not_announcement");
      return await sendText(sock, remoteJid, "🔓 *Grup telah dibuka!*\nSemua member bisa mengirim pesan.", message);
    } catch (err) {
      return await sendText(sock, remoteJid, `❌ Gagal membuka grup: ${err.message}`, message);
    }
  }

  // ── .hidetag ──────────────────────────────────────────
  if (command === "hidetag") {
    if (!info.isGroup) return await sendText(sock, remoteJid, "❌ Perintah ini hanya di grup!", message);
    const pesan = body.trim();
    if (!pesan) return await sendText(sock, remoteJid, "❌ Format: *.hidetag pesan*", message);
    try {
      const meta = await getGroupMeta(sock, remoteJid);
      if (!meta) throw new Error("Gagal ambil data grup");
      const mentions = meta.participants.map((p) => p.id);
      return await sendTextMention(sock, remoteJid, pesan, mentions);
    } catch (err) {
      return await sendText(sock, remoteJid, `❌ Gagal hidetag: ${err.message}`, message);
    }
  }

  // ── .proses [nama produk] — reply pesan user di grup store ──
  if (command === "proses") {
    if (!isQuoted || !quotedMsg) {
      return await sendText(sock, remoteJid,
        "❌ *Reply* pesan user terlebih dahulu, lalu ketik *.proses nama produk*\n\n*Contoh:* Reply pesan user → *.proses Canva 30 hari*",
        message);
    }

    const namaProduk = body.trim() || quotedMsg.text || "(tidak ada keterangan)";
    const jam = getTime();
    const tanggal = getDate();

    // Resolve info user (handle LID) — gunakan pushName dari cache atau quotedMsg
    const userRaw = quotedMsg.sender || "";
    const { nomorUser, namaUser, userJidResolved } = await resolveUser(
      sock, remoteJid, userRaw, quotedMsg.pushName || ""
    );

    // Generate kode transaksi
    const inisial = (config.INISIAL_TOKO || "TRX").toUpperCase();
    const [dd, mm, yyyy] = tanggal.split("/");
    const yy = yyyy?.slice(-2) || "00";
    const randomPart = Math.random().toString(36).toUpperCase().slice(2, 7);
    const kodeTrx = `${inisial}${dd}${mm}${yy}-${randomPart}`;

    // Pesan PROSES ke grup store
    const pesanStore =
      `TRANSAKSI SEDANG DIPROSES 🕐\n` +
      `${"=".repeat(22)}\n` +
      `🔖 Kode Trx :${kodeTrx}\n` +
      `⏰ Jam      : ${jam} WIB\n` +
      `📅 Tanggal  : ${tanggal}\n` +
      `📝 Pesanan  : ${namaProduk}\n` +
      `${"=".repeat(22)}\n` +
      `Pesanan sedang kami proses\n` +
      `Mohon Ditunggu dulu ya kak @${nomorUser} ☺️`;

    const mentionsStore = userJidResolved ? [userJidResolved] : [];
    const quotedKey = { remoteJid, id: quotedMsg.stanzaId, participant: quotedMsg.sender };

    await sock.sendMessage(
      remoteJid,
      { text: pesanStore, mentions: mentionsStore },
      { quoted: { key: quotedKey, message: quotedMsg.message } }
    );

    // Kirim ke grup notif + simpan transaksi pending
    if (config.GRUP_NOTIF && config.GRUP_NOTIF.trim()) {
      const pesanNotif =
        `📦 *NOTIFIKASI TRANSAKSI MASUK*\n` +
        `${"=".repeat(22)}\n` +
        `🔖 Kode Trx : *${kodeTrx}*\n` +
        `⏰ Jam      : ${jam} WIB\n` +
        `📅 Tanggal  : ${tanggal}\n` +
        `${"=".repeat(22)}\n` +
        `👤 Nama     : ${namaUser}\n` +
        `📱 Nomor    : ${formatNomor(nomorUser)}\n` +
        `📝 Produk   : ${namaProduk}\n` +
        `${"=".repeat(22)}\n` +
        `💬 Pesan    : _${quotedMsg.text || "(tidak ada teks)"}_\n` +
        `${"=".repeat(22)}\n` +
        `🕐 Status   : *PROSES*\n\n` +
        `_Reply pesan ini dengan .done [detail akun] untuk menyelesaikan transaksi_`;

      try {
        const sentNotif = await sock.sendMessage(config.GRUP_NOTIF.trim(), { text: pesanNotif });
        const notifStanzaId = sentNotif?.key?.id;
        if (notifStanzaId) {
          savePendingTransaction(notifStanzaId, {
            kodeTrx,
            namaProduk,
            userJid: userJidResolved,
            nomorUser,
            namaUser,
            storeJid: remoteJid,
            jam,
            tanggal,
          });
        }
      } catch (err) {
        logError("proses→notif", `Gagal kirim ke grup notif: ${err.message}`);
      }
    }

    return;
  }

  // ── .done [detail akun] — reply pesan notif di grup notif ──
  if (command === "done") {
    // Jika GRUP_NOTIF dikonfigurasi, .done hanya berlaku di grup notif
    if (config.GRUP_NOTIF && config.GRUP_NOTIF.trim() && remoteJid !== config.GRUP_NOTIF.trim()) {
      return await sendText(sock, remoteJid,
        "❌ Perintah *.done* hanya bisa digunakan di grup notifikasi!\n\nFormat: Reply pesan transaksi → *.done detail akun*",
        message);
    }

    if (!isQuoted || !quotedMsg) {
      return await sendText(sock, remoteJid,
        "❌ *Reply* pesan transaksi di grup notif ini, lalu ketik *.done detail akun*\n\n*Contoh:*\n.done\nEmail    : akun@gmail.com\nPassword : pass123\nExpired  : 30 hari",
        message);
    }

    // Cari transaksi pending
    const trxKey = quotedMsg.stanzaId;
    const trx = getPendingTransaction(trxKey);

    if (!trx) {
      return await sendText(sock, remoteJid,
        "❌ Transaksi tidak ditemukan atau sudah selesai.\nPastikan Anda reply pesan notif transaksi yang benar.",
        message);
    }

    const detailAkun = body.trim() || "(tidak ada detail akun)";
    const jam = getTime();
    const tanggal = getDate();

    // Pesan SELESAI di grup notif (untuk admin copy ke customer)
    const pesanNotifDone =
      `✅ *TRANSAKSI SELESAI*\n` +
      `${"=".repeat(22)}\n` +
      `🔖 Kode Trx : *${trx.kodeTrx}*\n` +
      `⏰ Selesai  : ${jam} WIB\n` +
      `📅 Tanggal  : ${tanggal}\n` +
      `${"=".repeat(22)}\n` +
      `👤 Nama     : ${trx.namaUser}\n` +
      `📱 Nomor    : ${formatNomor(trx.nomorUser)}\n` +
      `📝 Produk   : ${trx.namaProduk}\n` +
      `${"=".repeat(22)}\n` +
      `🔑 *DETAIL AKUN:*\n${detailAkun}\n` +
      `${"=".repeat(22)}\n` +
      `✅ Status   : *SELESAI*`;

    await sock.sendMessage(
      remoteJid,
      { text: pesanNotifDone },
      { quoted: { key: { remoteJid, id: quotedMsg.stanzaId, participant: quotedMsg.sender }, message: quotedMsg.message } }
    );

    // Kirim DONE ke grup store (otomatis)
    if (trx.storeJid) {
      const pesanStore =
        `TRANSAKSI BERHASIL ✅\n` +
        `${"=".repeat(23)}\n` +
        `Kode transaksi : ${trx.kodeTrx}\n` +
        `⏰ Jam      : ${jam} WIB\n` +
        `📅 Tanggal  : ${tanggal}\n` +
        `📝 Pesanan  : ${trx.namaProduk}\n` +
        `${"=".repeat(23)}\n` +
        `Yaeyy!!! Pesanan sudah berhasil\n` +
        `@${trx.namaUser} Ditunggu next ordernya ya kak!! ☺️`;

      const mentionsStore = trx.userJid ? [trx.userJid] : [];
      try {
        await sock.sendMessage(trx.storeJid, { text: pesanStore, mentions: mentionsStore });
      } catch (err) {
        logError("done→store", `Gagal kirim ke grup store: ${err.message}`);
      }
    }

    // Hapus transaksi dari pending
    deletePendingTransaction(trxKey);
    return;
  }

  // Tidak ada perintah yang cocok
  return false;
}
