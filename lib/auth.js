// ============================================================
//  lib/auth.js - Custom Auth State (Singleton, persistent)
//
//  PENTING: Auth state dibuat SEKALI dan di-reuse lintas
//  reconnect. Ini mencegah bug di mana setiap reconnect
//  membuat instance baru dengan keysData kosong → 401.
//
//  Perbaikan:
//  - Singleton factory (state tidak hilang saat reconnect)
//  - Debounce saveCreds 500ms (cegah partial write)
//  - writeJSON atomic dengan .tmp file
// ============================================================

import { promises as fs } from "fs";
import path from "path";
import { proto, initAuthCreds, BufferJSON } from "baileys";

// ── Module-level singleton ────────────────────────────────
// State ini hidup sepanjang proses Node.js berjalan.
// Tidak akan hilang meski connectToWhatsApp() dipanggil ulang.
let _creds = null;
let _keysData = null;
let _sessionDir = null;
let _initialized = false;

// Debounce timer untuk saveCreds
let _saveCredsTimer = null;

// ── Helper: tulis file JSON atomic ───────────────────────
async function writeJSON(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = filePath + ".tmp";
  await fs.writeFile(
    tmp,
    JSON.stringify(data, BufferJSON.replacer, 2),
    "utf8"
  );
  await fs.rename(tmp, filePath);
}

// ── Inisialisasi singleton (hanya dijalankan sekali) ─────
async function initOnce(sessionDir) {
  if (_initialized && _sessionDir === sessionDir) {
    // Sudah diinit, kembalikan state yang sudah ada
    return;
  }

  _sessionDir = sessionDir;
  await fs.mkdir(sessionDir, { recursive: true });

  const credsPath = path.join(sessionDir, "creds.json");
  const keysPath = path.join(sessionDir, "keys.json");

  // Load credentials dari disk
  try {
    const raw = await fs.readFile(credsPath, "utf8");
    _creds = JSON.parse(raw, BufferJSON.reviver);
  } catch {
    _creds = initAuthCreds();
  }

  // Load keys dari disk
  try {
    const raw = await fs.readFile(keysPath, "utf8");
    _keysData = JSON.parse(raw, BufferJSON.reviver);
  } catch {
    _keysData = {};
  }

  _initialized = true;
}

/**
 * Singleton auth state — aman dipanggil berkali-kali.
 * Instance pertama membaca dari disk, pemanggilan berikutnya
 * mengembalikan state yang sama dari memori.
 *
 * @param {string} sessionDir - Path folder session
 * @returns {{ state, saveCreds }}
 */
export async function useSingleFileAuthState(sessionDir) {
  await initOnce(sessionDir);

  const credsPath = path.join(sessionDir, "creds.json");
  const keysPath = path.join(sessionDir, "keys.json");

  // ── saveCreds dengan debounce 500ms ──────────────────
  // Mencegah penulisan berulang dalam waktu sangat singkat
  // yang bisa menyebabkan partial write / file korup.
  async function saveCreds() {
    if (_saveCredsTimer) clearTimeout(_saveCredsTimer);
    _saveCredsTimer = setTimeout(async () => {
      try {
        await writeJSON(credsPath, _creds);
      } catch (err) {
        console.error("[Auth] Gagal menyimpan creds:", err.message);
      }
    }, 500);
  }

  // ── Keys interface ────────────────────────────────────
  const keys = {
    get(type, ids) {
      const typeStore = _keysData[type] || {};
      const result = {};
      for (const id of ids) {
        let val = typeStore[id];
        if (val !== undefined && val !== null) {
          // Khusus app-state-sync-key: wrap ke proto
          if (type === "app-state-sync-key" && !val.fingerprint) {
            val = proto.Message.AppStateSyncKeyData.fromObject(val);
          }
          result[id] = val;
        }
      }
      return result;
    },

    async set(data) {
      let changed = false;
      for (const type in data) {
        if (!_keysData[type]) _keysData[type] = {};
        for (const id in data[type]) {
          const val = data[type][id];
          if (val == null) {
            delete _keysData[type][id];
          } else {
            _keysData[type][id] = val;
          }
          changed = true;
        }
        // Hapus tipe jika sudah kosong
        if (_keysData[type] && Object.keys(_keysData[type]).length === 0) {
          delete _keysData[type];
        }
      }
      if (changed) {
        try {
          await writeJSON(keysPath, _keysData);
        } catch (err) {
          console.error("[Auth] Gagal menyimpan keys:", err.message);
        }
      }
    },

    async clear() {
      _keysData = {};
      try {
        await writeJSON(keysPath, _keysData);
      } catch (err) {
        console.error("[Auth] Gagal clear keys:", err.message);
      }
    },
  };

  // State menggunakan referensi ke _creds (singleton)
  // Baileys akan memodifikasi object ini secara langsung
  return {
    state: { creds: _creds, keys },
    saveCreds,
  };
}

/**
 * Reset singleton (hanya dipanggil saat logout permanen)
 * Setelah ini, pemanggilan useSingleFileAuthState berikutnya
 * akan membaca ulang dari disk (atau membuat creds baru).
 */
export function resetAuthState() {
  _creds = null;
  _keysData = null;
  _initialized = false;
  _sessionDir = null;
  if (_saveCredsTimer) {
    clearTimeout(_saveCredsTimer);
    _saveCredsTimer = null;
  }
}
