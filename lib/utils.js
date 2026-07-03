// ============================================================
//  lib/utils.js - Fungsi-fungsi Helper
// ============================================================

import moment from "moment-timezone";
import config from "../config.js";
import chalk from "chalk";

// ── Format tanggal & waktu WIB ──────────────────────────────
export function getTime() {
  return moment().tz(config.TIMEZONE).format("HH:mm:ss");
}

export function getDate() {
  return moment().tz(config.TIMEZONE).format("DD/MM/YYYY");
}

export function getNow() {
  return { jam: getTime(), tanggal: getDate() };
}

// ── Cek apakah sender adalah owner bot ─────────────────────
export function isOwner(sender) {
  const nomor = sender.replace(/@s\.whatsapp\.net$|@lid$/, "");
  return config.OWNER.some((o) => o.replace(/\D/g, "") === nomor.replace(/\D/g, ""));
}

// ── Cek apakah sender adalah admin grup ────────────────────
export function isGroupAdmin(participants, sender) {
  return participants.some(
    (p) =>
      (p.id === sender || p.id?.split("@")[0] === sender?.split("@")[0]) &&
      (p.admin === "admin" || p.admin === "superadmin")
  );
}

// ── Format nomor WhatsApp jadi JID ─────────────────────────
export function toJid(nomor) {
  const bersih = nomor.replace(/\D/g, "");
  return `${bersih}@s.whatsapp.net`;
}

// ── Logging ke terminal ─────────────────────────────────────
export function log(label, msg, warna = "white") {
  const waktu = chalk.gray(`[${getTime()}]`);
  const labelStr = chalk.cyan(`[${label}]`);
  console.log(`${waktu} ${labelStr} ${chalk[warna](msg)}`);
}

export function logError(label, msg) {
  log(label, msg, "redBright");
}

export function logSuccess(label, msg) {
  log(label, msg, "greenBright");
}

// ── Kirim pesan teks ────────────────────────────────────────
export async function sendText(sock, jid, text, quoted = null) {
  try {
    const options = quoted ? { quoted } : {};
    return await sock.sendMessage(jid, { text }, options);
  } catch (err) {
    logError("sendText", err.message);
  }
}

// ── Kirim gambar ────────────────────────────────────────────
export async function sendImage(sock, jid, buffer, caption = "", quoted = null) {
  try {
    const options = quoted ? { quoted } : {};
    return await sock.sendMessage(jid, { image: buffer, caption }, options);
  } catch (err) {
    logError("sendImage", err.message);
  }
}

// ── Kirim pesan dengan mention ──────────────────────────────
export async function sendTextMention(sock, jid, text, mentionedJids = [], quoted = null) {
  try {
    const options = { ...(quoted ? { quoted } : {}) };
    return await sock.sendMessage(jid, { text, mentions: mentionedJids }, options);
  } catch (err) {
    logError("sendTextMention", err.message);
  }
}

// ── Ambil metadata grup ─────────────────────────────────────
export async function getGroupMeta(sock, groupJid) {
  try {
    return await sock.groupMetadata(groupJid);
  } catch {
    return null;
  }
}

// ── Sleep / delay ───────────────────────────────────────────
export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
