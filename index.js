// ============================================================
//  index.js - Entry Point Bot WhatsApp
// ============================================================

import chalk from "chalk";
import { loadDB } from "./lib/db.js";
import { connectToWhatsApp } from "./lib/connection.js";
import { log, logError, logSuccess } from "./lib/utils.js";

// ── Cek versi Node.js ────────────────────────────────────
const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  console.error(chalk.redBright("❌ Bot ini membutuhkan Node.js versi 20 ke atas!"));
  console.error(chalk.yellow(`   Versi yang terdeteksi: Node.js ${process.versions.node}`));
  process.exit(1);
}

// ── Set timezone ─────────────────────────────────────────
process.env.TZ = "Asia/Jakarta";

// ── Banner ───────────────────────────────────────────────
console.log();
console.log(chalk.cyan("╔══════════════════════════════════════╗"));
console.log(chalk.cyan("║         🤖 WHATSAPP BOT              ║"));
console.log(chalk.cyan("║         Simple & Clean               ║"));
console.log(chalk.cyan("╠══════════════════════════════════════╣"));
console.log(chalk.cyan(`║  Node.js : ${chalk.white(process.versions.node.padEnd(28))}║`));
console.log(chalk.cyan("╚══════════════════════════════════════╝"));
console.log();

// ── Error handler global ─────────────────────────────────
process.on("uncaughtException", (err) => {
  logError("UncaughtException", err.message);
  console.error(err);
});

process.on("unhandledRejection", (reason) => {
  logError("UnhandledRejection", String(reason));
});

// ── Start ────────────────────────────────────────────────
async function start() {
  try {
    // Load semua database ke memori
    await loadDB();
    logSuccess("DB", "Database berhasil dimuat");

    // Koneksi ke WhatsApp
    log("System", "Menghubungkan ke WhatsApp...");
    await connectToWhatsApp();
  } catch (err) {
    logError("Start", err.message);
    console.error(err);
    process.exit(1);
  }
}

start();
