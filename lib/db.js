// ============================================================
//  lib/db.js - Database Manager (JSON file-based)
// ============================================================

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, "../database");

// Cache in-memory
let products = {};
let payment = {};
let settings = {};
let admins = [];
let transactions = {}; // key: stanzaId pesan notif

// ── Helper: baca file JSON ────────────────────────────────
async function readJSON(file) {
  try {
    const data = await fs.readFile(path.join(DB_DIR, file), "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ── Helper: tulis file JSON ───────────────────────────────
async function writeJSON(file, data) {
  await fs.writeFile(path.join(DB_DIR, file), JSON.stringify(data, null, 2), "utf8");
}

// ── Load semua database ke memori ────────────────────────
export async function loadDB() {
  products     = (await readJSON("products.json"))     || {};
  payment      = (await readJSON("payment.json"))      || { gambar: null, keterangan: "" };
  settings     = (await readJSON("settings.json"))     || { rules: "", welcome: "", welcomeGambar: null, notifOwner: true };
  admins       = (await readJSON("admins.json"))       || [];
  transactions = (await readJSON("transactions.json")) || {};
}

// ── PRODUCTS ─────────────────────────────────────────────

export function getProducts() {
  return products;
}

export function getProduct(nama) {
  const key = nama.toLowerCase().trim();
  return products[key] || null;
}

export function addProduct(nama, deskripsi) {
  const key = nama.toLowerCase().trim();
  if (products[key]) return false; // sudah ada
  products[key] = { nama: nama.trim(), deskripsi: deskripsi.trim(), createdAt: new Date().toISOString() };
  saveProducts();
  return true;
}

export function editProduct(nama, deskripsi) {
  const key = nama.toLowerCase().trim();
  if (!products[key]) return false;
  products[key] = { ...products[key], deskripsi: deskripsi.trim(), updatedAt: new Date().toISOString() };
  saveProducts();
  return true;
}

export function deleteProduct(nama) {
  const key = nama.toLowerCase().trim();
  if (!products[key]) return false;
  delete products[key];
  saveProducts();
  return true;
}

async function saveProducts() {
  await writeJSON("products.json", products);
}

// ── PAYMENT ──────────────────────────────────────────────

export function getPayment() {
  return payment;
}

export function setPayment(keterangan, gambarBase64 = null) {
  payment.keterangan = keterangan;
  if (gambarBase64 !== null) payment.gambar = gambarBase64;
  savePayment();
}

async function savePayment() {
  await writeJSON("payment.json", payment);
}

// ── SETTINGS (rules & welcome) ────────────────────────────

export function getSettings() {
  return settings;
}

export function setRules(text) {
  settings.rules = text;
  saveSettings();
}

export function setWelcome(text, gambarBase64 = null) {
  settings.welcome = text;
  if (gambarBase64 !== null) settings.welcomeGambar = gambarBase64;
  saveSettings();
}

export function setCaraOrder(text, gambarBase64 = null) {
  settings.caraOrder = text;
  if (gambarBase64 !== null) settings.caraOrderGambar = gambarBase64;
  saveSettings();
}

export function setListBanner(gambarBase64) {
  settings.listBanner = gambarBase64;
  saveSettings();
}

export function removeListBanner() {
  settings.listBanner = null;
  saveSettings();
}

export function isNotifOwnerOn() {
  // Default true jika belum pernah diset
  return settings.notifOwner !== false;
}

export function setNotifOwner(status) {
  settings.notifOwner = status;
  saveSettings();
}

async function saveSettings() {
  await writeJSON("settings.json", settings);
}

// ── ADMINS ────────────────────────────────────────────────

export function getAdmins() {
  return admins;
}

export function addAdmin(nomor) {
  const bersih = nomor.replace(/\D/g, "");
  if (admins.includes(bersih)) return false;
  admins.push(bersih);
  saveAdmins();
  return true;
}

export function removeAdmin(nomor) {
  const bersih = nomor.replace(/\D/g, "");
  const idx = admins.indexOf(bersih);
  if (idx === -1) return false;
  admins.splice(idx, 1);
  saveAdmins();
  return true;
}

async function saveAdmins() {
  await writeJSON("admins.json", admins);
}

// ── TRANSACTIONS (transaksi pending) ─────────────────────

/**
 * Simpan transaksi pending.
 * Key: stanzaId pesan notif yang dikirim bot (untuk di-reply admin)
 * @param {string} notifStanzaId - ID pesan notif dari bot
 * @param {object} data - { kodeTrx, namaProduk, userJid, nomorUser, namaUser, storeJid, jam, tanggal }
 */
export function savePendingTransaction(notifStanzaId, data) {
  transactions[notifStanzaId] = { ...data, createdAt: new Date().toISOString() };
  saveTransactions();
}

/**
 * Cari transaksi berdasarkan stanzaId pesan notif yang di-reply admin.
 */
export function getPendingTransaction(notifStanzaId) {
  return transactions[notifStanzaId] || null;
}

/**
 * Hapus transaksi setelah selesai (.done sudah diproses).
 */
export function deletePendingTransaction(notifStanzaId) {
  if (!transactions[notifStanzaId]) return;
  delete transactions[notifStanzaId];
  saveTransactions();
}

async function saveTransactions() {
  await writeJSON("transactions.json", transactions);
}
