// ============================================================
//  lib/message.js - Parse & Serialize Pesan Masuk
// ============================================================

import { getContentType } from "baileys";
import config from "../config.js";

// ── Cache LID → info user (pushName) ─────────────────────
// Diisi setiap ada pesan masuk sehingga kita bisa resolve LID ke nama
const lidCache = {};

/**
 * Simpan info user ke cache berdasarkan JID mereka
 */
export function cacheLid(jid, pushName) {
  if (!jid || !pushName) return;
  lidCache[jid] = { pushName, updatedAt: Date.now() };
  // Juga simpan tanpa suffix @s.whatsapp.net / @lid
  const base = jid.split("@")[0];
  lidCache[base] = { pushName, updatedAt: Date.now() };
}

/**
 * Ambil info user dari cache berdasarkan JID atau base number
 */
export function getLidInfo(jid) {
  if (!jid) return null;
  return lidCache[jid] || lidCache[jid.split("@")[0]] || null;
}

/**
 * Parse pesan masuk dari event messages.upsert
 * Mengembalikan objek info pesan yang mudah digunakan
 */
export default function parseMessage(m, sock) {
  try {
    if (!m?.messages?.[0]) return null;
    if (m.type === "append") return null;

    const msg = m.messages[0];
    if (!msg?.message) return null;

    // ── Timestamp check (abaikan pesan lama > 30 detik) ──
    const timestamp = msg.messageTimestamp;
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > 30) return null;

    const key = msg.key || {};
    const remoteJid = key.remoteJid || "";
    const fromMe = key.fromMe || false;
    const participant = key.participant || msg.participant || "";

    const isGroup = remoteJid.endsWith("@g.us");
    const sender = isGroup ? participant : remoteJid;
    const pushName = msg.pushName || "";

    // Simpan ke cache: LID/JID → pushName (untuk resolve nama nanti)
    if (sender && pushName) {
      cacheLid(sender, pushName);
    }

    // ── Tentukan tipe & konten pesan ─────────────────────
    const rawType = getContentType(msg.message);
    let type = rawType || "unknown";
    let text = "";

    if (type === "conversation") {
      text = msg.message.conversation || "";
    } else if (type === "extendedTextMessage") {
      text = msg.message.extendedTextMessage?.text || "";
    } else if (type === "imageMessage") {
      text = msg.message.imageMessage?.caption || "";
      type = "imageMessage";
    } else if (type === "videoMessage") {
      text = msg.message.videoMessage?.caption || "";
      type = "videoMessage";
    } else if (type === "stickerMessage") {
      text = "";
      type = "stickerMessage";
    } else if (type === "audioMessage") {
      text = "";
      type = "audioMessage";
    } else if (type === "documentMessage") {
      text = msg.message.documentMessage?.caption || "";
      type = "documentMessage";
    }

    // ── Deteksi pesan yang dikutip (quoted) ──────────────
    let quotedMsg = null;
    const ctx = msg.message?.extendedTextMessage?.contextInfo ||
                msg.message?.imageMessage?.contextInfo ||
                msg.message?.videoMessage?.contextInfo ||
                msg.message?.documentMessage?.contextInfo;

    if (ctx?.quotedMessage) {
      const quotedType = getContentType(ctx.quotedMessage);
      const quotedText =
        ctx.quotedMessage?.conversation ||
        ctx.quotedMessage?.extendedTextMessage?.text ||
        ctx.quotedMessage?.imageMessage?.caption ||
        "";

      // Coba ambil sender dari remoteJid jika bukan grup (chat pribadi)
      // ctx.participant bisa berformat @lid (LID) atau @s.whatsapp.net
      const quotedSender = ctx.participant || "";

      // Coba resolve pushName dari cache LID
      const cachedInfo = getLidInfo(quotedSender);
      const quotedPushName = cachedInfo?.pushName || ctx.pushName || "";

      quotedMsg = {
        type: quotedType,
        text: quotedText,
        sender: quotedSender,
        pushName: quotedPushName,
        stanzaId: ctx.stanzaId || "",
        message: ctx.quotedMessage,
        key: {
          remoteJid,
          id: ctx.stanzaId,
          participant: quotedSender,
        },
      };
    }

    // ── Parse command (untuk perintah admin dengan prefix) ─
    const trimmed = text.trim();
    const usedPrefix = config.PREFIX && trimmed.startsWith(config.PREFIX)
      ? config.PREFIX
      : null;

    let command = "";
    let args = [];
    let body = trimmed;

    if (usedPrefix) {
      const withoutPrefix = trimmed.slice(usedPrefix.length).trim();
      const parts = withoutPrefix.split(/\s+/);
      command = parts[0]?.toLowerCase() || "";
      args = parts.slice(1);
      body = withoutPrefix.slice(command.length).trim();
    } else {
      // Perintah tanpa prefix (list, pay, rules, nama produk)
      const parts = trimmed.split(/\s+/);
      command = parts[0]?.toLowerCase() || "";
      args = parts.slice(1);
      body = trimmed.slice(command.length).trim();
    }

    return {
      // Info dasar
      key,
      remoteJid,
      sender,
      pushName,
      fromMe,
      isGroup,

      // Tipe & konten
      type,
      text: trimmed,
      fullText: trimmed,

      // Command parsing
      prefix: usedPrefix,
      command,
      args,
      body,         // teks setelah command (tanpa command itu sendiri)

      // Quoted message
      isQuoted: !!quotedMsg,
      quotedMsg,

      // Raw message object (untuk operasi lanjutan)
      message: msg,
      sock,
    };
  } catch (err) {
    return null;
  }
}
