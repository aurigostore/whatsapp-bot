// ============================================================
//  lib/connection.js - Koneksi WhatsApp via Baileys
//
//  Perbaikan:
//  - Pola reconnect menggunakan loop (bukan rekursi)
//    agar auth state SINGLETON tidak di-reinit setiap reconnect
//  - sock.ev.removeAllListeners() sebelum buat socket baru
//    agar tidak ada listener event duplikat / memory leak
//  - resetAuthState() hanya dipanggil saat logout permanen
// ============================================================

import makeWASocket, {
  fetchLatestBaileysVersion,
  DisconnectReason,
} from "baileys";
import { useSingleFileAuthState, resetAuthState } from "./auth.js";
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

// Bersihkan lastReply setiap 10 menit agar tidak memory leak
setInterval(() => {
  const now = Date.now();
  for (const jid in lastReply) {
    if (now - lastReply[jid] > 600_000) {
      delete lastReply[jid];
    }
  }
}, 600_000);

// ── Fungsi utama koneksi ──────────────────────────────────
export async function connectToWhatsApp() {
  // Pastikan folder session ada
  await fs.mkdir(SESSION_DIR, { recursive: true });

  // Auth state dibuat SEKALI di sini.
  // Saat reconnect (loop), fungsi ini tidak dipanggil ulang —
  // kita tetap pakai state yang sama dari memori.
  const { state, saveCreds } = await useSingleFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  // ── Loop reconnect ────────────────────────────────────
  // Menggantikan pola rekursi. Saat koneksi putus dan perlu
  // reconnect, kita buat socket baru tapi pakai state YANG SAMA.
  let shouldRun = true;

  while (shouldRun) {
    let sock;

    try {
      sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,          // ← state singleton, tidak berubah
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 30_000,
      });
    } catch (err) {
      logError("Socket", `Gagal membuat socket: ${err.message}`);
      await delay(5000);
      continue;
    }

    // ── Pairing Code (hanya saat belum registered) ──────
    if (
      !state.creds.registered &&
      config.KONEKSI.toLowerCase() === "pairing"
    ) {
      try {
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
      } catch (err) {
        logError("Pairing", `Gagal minta pairing code: ${err.message}`);
      }
    }

    // ── Save credentials ─────────────────────────────────
    sock.ev.on("creds.update", saveCreds);

    // ── Connection update ─────────────────────────────────
    // Dibungkus Promise agar loop menunggu sampai koneksi
    // benar-benar putus sebelum melanjutkan iterasi berikutnya.
    await new Promise((resolve) => {
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code mode
        if (qr && config.KONEKSI.toLowerCase() === "qr") {
          qrCount++;
          qrcode.generate(qr, { small: true });
          log("QR", `Scan QR Code di atas! (${qrCount}/5)`);
          if (qrCount >= 5) {
            logError("QR", "QR expired. Silakan restart bot.");
            shouldRun = false;
            resolve();
          }
        }

        if (connection === "close") {
          const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
          logError("Connection", `Koneksi terputus. Reason: ${statusCode}`);

          // Bersihkan semua listener socket lama
          sock.ev.removeAllListeners();

          if (statusCode === DisconnectReason.loggedOut) {
            // Logout permanen — reset state agar bisa pair ulang
            logError("Connection", "Logged out! Hapus folder session dan restart bot.");
            resetAuthState();
            shouldRun = false;
            process.exit(1);
          } else if (statusCode === 401) {
            // 401 selain loggedOut — sama, perlu pair ulang
            logError("Connection", "Unauthorized (401). Hapus folder session dan restart bot.");
            resetAuthState();
            shouldRun = false;
            process.exit(1);
          } else {
            // Disconnect biasa (network blip, timeout, dll) → reconnect
            const waitMs = statusCode === 408 ? 10_000 : 5_000;
            log("Connection", `Mencoba reconnect dalam ${waitMs / 1000} detik...`);
            await delay(waitMs);
            resolve(); // lanjut iterasi loop berikutnya
          }
        } else if (connection === "open") {
          qrCount = 0;
          logSuccess("Connection", "✅ Bot WhatsApp berhasil terhubung!");

          // Kirim notif ke owner
          try {
            const ownerJid = `${config.OWNER[0].replace(/\D/g, "")}@s.whatsapp.net`;
            await sock.sendMessage(ownerJid, {
              text: "✅ *Bot WhatsApp aktif!*\n\nBot berhasil terhubung dan siap digunakan.",
            });
          } catch {}
        }
      });

      // ── Messages Upsert ──────────────────────────────
      sock.ev.on("messages.upsert", async (m) => {
        try {
          const info = parseMessage(m, sock);
          if (!info) return;
          if (info.fromMe) return;

          const { remoteJid, command, prefix, sender } = info;

          if (!isOwner(sender) && isRateLimited(remoteJid)) return;

          if (info.text) {
            const asal = info.isGroup ? `[GRUP] ${remoteJid}` : `[PRIVATE]`;
            log(asal, `${info.pushName || sender.split("@")[0]}: ${info.text.slice(0, 50)}`);
          }

          if (prefix) {
            await handleAdmin(sock, info);
            return;
          }

          await handleUser(sock, info);
        } catch (err) {
          logError("messages.upsert", err.message);
        }
      });

      // ── Group Participants Update ─────────────────────
      sock.ev.on("group-participants.update", async (event) => {
        try {
          if (!event?.id || !event?.participants || !event?.action) return;
          await handleWelcome(sock, event);
        } catch (err) {
          logError("group-participants.update", err.message);
        }
      });
    });

    // Jeda sebentar sebelum membuat socket baru
    if (shouldRun) {
      await delay(1000);
    }
  }
}
