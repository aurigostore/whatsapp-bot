// ============================================================
//  lib/connection.js - Koneksi WhatsApp via Baileys
// ============================================================

import makeWASocket, {
  fetchLatestBaileysVersion,
  DisconnectReason,
} from "baileys";
import { useSingleFileAuthState } from "./auth.js";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";
import chalk from "chalk";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

import config from "../config.js";
import parseMessage from "./message.js";
import { handleUser } from "../handlers/user.js";
import { handleAdmin } from "../handlers/admin.js";
import { handleWelcome } from "../handlers/welcome.js";
import { log, logError, logSuccess, isOwner } from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.join(__dirname, "../session");

const logger = pino({ level: "silent" });
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

let qrCount = 0;
const error403Times = [];

// ── Rate limiter per chat ─────────────────────────────────
const lastReply = {};
function isRateLimited(jid) {
  const now = Date.now();
  if (lastReply[jid] && now - lastReply[jid] < config.RATE_LIMIT) {
    return true;
  }
  lastReply[jid] = now;
  return false;
}

// ── Fungsi utama koneksi ──────────────────────────────────
export async function connectToWhatsApp() {
  // Pastikan folder session ada
  await fs.mkdir(SESSION_DIR, { recursive: true });

  const { state, saveCreds } = await useSingleFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
  });

  // ── Pairing Code ───────────────────────────────────────
  if (
    !sock.authState.creds.registered &&
    config.KONEKSI.toLowerCase() === "pairing"
  ) {
    await delay(3000);
    const code = await sock.requestPairingCode(config.NOMOR_BOT.trim());
    const formatted = code.slice(0, 4) + "-" + code.slice(4);
    console.log();
    console.log(chalk.yellow("┌─────────────────────────────────┐"));
    console.log(chalk.yellow("│   🔑 KODE PAIRING WHATSAPP       │"));
    console.log(chalk.yellow("├─────────────────────────────────┤"));
    console.log(chalk.yellow(`│   Nomor  : ${chalk.white(config.NOMOR_BOT.padEnd(22))}│`));
    console.log(chalk.yellow(`│   Kode   : ${chalk.greenBright(formatted.padEnd(22))}│`));
    console.log(chalk.yellow("└─────────────────────────────────┘"));
    console.log();
    console.log(chalk.gray("📱 Buka WhatsApp → Perangkat Tertaut → Tautkan dengan Nomor Telepon"));
    console.log();
  }

  // ── Save credentials ───────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ── Connection update ──────────────────────────────────
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // QR Code mode
    if (qr && config.KONEKSI.toLowerCase() === "qr") {
      qrCount++;
      qrcode.generate(qr, { small: true });
      log("QR", `Scan QR Code di atas! (${qrCount}/5)`);
      if (qrCount >= 5) {
        logError("QR", "QR expired. Silakan restart bot.");
        process.exit(0);
      }
    }

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;

      logError("Connection", `Koneksi terputus. Reason: ${reason}`);

      // Handle error 403 berulang
      if (reason === 403) {
        const now = Date.now();
        error403Times.push(now);
        const recent = error403Times.filter((t) => now - t < 60000);
        if (recent.length > 3) {
          logError("Connection", "Terlalu banyak error 403. Berhenti reconnect sementara.");
          return;
        }
      }

      if (shouldReconnect) {
        log("Connection", "Mencoba reconnect dalam 5 detik...");
        await delay(5000);
        connectToWhatsApp();
      } else {
        logError("Connection", "Logged out! Hapus folder session dan restart bot.");
        process.exit(1);
      }
    } else if (connection === "open") {
      qrCount = 0;
      logSuccess("Connection", "✅ Bot WhatsApp berhasil terhubung!");

      // Kirim notif ke owner
      try {
        const ownerJid = `${config.OWNER[0].replace(/\D/g, "")}@s.whatsapp.net`;
        await sock.sendMessage(ownerJid, { text: "✅ *Bot WhatsApp aktif!*\n\nBot berhasil terhubung dan siap digunakan." });
      } catch {}
    }
  });

  // ── Messages Upsert (pesan masuk) ────────────────────
  sock.ev.on("messages.upsert", async (m) => {
    try {
      const info = parseMessage(m, sock);
      if (!info) return;
      if (info.fromMe) return; // abaikan pesan dari bot sendiri

      const { remoteJid, command, prefix, sender } = info;

      // Rate limit (kecuali owner)
      if (!isOwner(sender) && isRateLimited(remoteJid)) return;

      // Log pesan masuk
      if (info.text) {
        const asal = info.isGroup ? `[GRUP] ${remoteJid}` : `[PRIVATE]`;
        log(asal, `${info.pushName || sender.split("@")[0]}: ${info.text.slice(0, 50)}`);
      }

      // ── Proses perintah admin (ada prefix) ──────────
      if (prefix) {
        await handleAdmin(sock, info);
        return;
      }

      // ── Proses perintah user (tanpa prefix) ─────────
      await handleUser(sock, info);
    } catch (err) {
      logError("messages.upsert", err.message);
    }
  });

  // ── Group Participants Update (join/leave/dll) ────────
  sock.ev.on("group-participants.update", async (event) => {
    try {
      if (!event?.id || !event?.participants || !event?.action) return;
      await handleWelcome(sock, event);
    } catch (err) {
      logError("group-participants.update", err.message);
    }
  });

  return sock;
}
