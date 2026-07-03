// ============================================================
//  lib/auth.js - Custom Auth State (Single-file storage)
//  Mengganti useMultiFileAuthState dari Baileys agar semua
//  keys (pre-key, lid-mapping, dll) disimpan dalam 1 file
//  saja: session/keys.json — bukan ratusan file terpisah.
// ============================================================

import { promises as fs } from "fs";
import path from "path";
import { proto, initAuthCreds, BufferJSON } from "baileys";

/**
 * Custom auth state yang menyimpan semua keys ke 1 file JSON.
 * Pengganti useMultiFileAuthState bawaan Baileys.
 *
 * @param {string} sessionDir - Path folder session
 * @returns {{ state, saveCreds }}
 */
export async function useSingleFileAuthState(sessionDir) {
  const credsPath = path.join(sessionDir, "creds.json");
  const keysPath  = path.join(sessionDir, "keys.json");

  // Pastikan folder ada
  await fs.mkdir(sessionDir, { recursive: true });

  // ── Load credentials ──────────────────────────────────
  let creds;
  try {
    const raw = await fs.readFile(credsPath, "utf8");
    creds = JSON.parse(raw, BufferJSON.reviver);
  } catch {
    creds = initAuthCreds();
  }

  // ── Load semua keys dari 1 file ───────────────────────
  let keysData = {};
  try {
    const raw = await fs.readFile(keysPath, "utf8");
    keysData = JSON.parse(raw, BufferJSON.reviver);
  } catch {
    keysData = {};
  }

  // ── Helper: tulis file JSON atomic ───────────────────
  async function writeJSON(filePath, data) {
    const tmp = filePath + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(data, BufferJSON.replacer, 2), "utf8");
    await fs.rename(tmp, filePath);
  }

  // ── Save credentials ──────────────────────────────────
  async function saveCreds() {
    await writeJSON(credsPath, creds);
  }

  // ── Keys interface (get/set/clear) ────────────────────
  const keys = {
    /**
     * Ambil keys berdasarkan tipe dan list ID
     * @param {string} type - Tipe key (e.g. "pre-key", "session", "lid-mapping")
     * @param {string[]} ids - List ID yang dicari
     */
    get(type, ids) {
      const typeStore = keysData[type] || {};
      const result = {};
      for (const id of ids) {
        let val = typeStore[id];
        if (val) {
          // Khusus app-state-sync-key: wrap ke proto
          if (type === "app-state-sync-key" && val && !val.fingerprint) {
            val = proto.Message.AppStateSyncKeyData.fromObject(val);
          }
          result[id] = val;
        }
      }
      return result;
    },

    /**
     * Simpan keys baru ke store
     * @param {object} data - { [type]: { [id]: value } }
     */
    async set(data) {
      let changed = false;
      for (const type in data) {
        if (!keysData[type]) keysData[type] = {};
        for (const id in data[type]) {
          const val = data[type][id];
          if (val == null) {
            // Hapus key yang di-null-kan
            delete keysData[type][id];
          } else {
            keysData[type][id] = val;
          }
          changed = true;
        }
        // Hapus tipe jika sudah kosong
        if (keysData[type] && Object.keys(keysData[type]).length === 0) {
          delete keysData[type];
        }
      }
      if (changed) {
        await writeJSON(keysPath, keysData);
      }
    },

    /**
     * Hapus semua keys (reset)
     */
    async clear() {
      keysData = {};
      await writeJSON(keysPath, keysData);
    },
  };

  return {
    state: { creds, keys },
    saveCreds,
  };
}
