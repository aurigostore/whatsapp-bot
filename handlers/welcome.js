// ============================================================
//  handlers/welcome.js - Handler Member Baru Join Grup
// ============================================================

import { getSettings } from "../lib/db.js";
import {
  sendText,
  sendImage,
  sendTextMention,
  getGroupMeta,
  logError,
} from "../lib/utils.js";

export async function handleWelcome(sock, eventInfo) {
  const { id, participants, action } = eventInfo;

  if (action !== "add") return; // Hanya proses event join

  const settings = getSettings();

  for (const participant of participants) {
    // Normalisasi participant (bisa string atau object)
    const participantJid =
      typeof participant === "string" ? participant : participant?.id || participant;

    if (!participantJid) continue;

    const nomorUser = participantJid.split("@")[0];

    try {
      const meta = await getGroupMeta(sock, id);
      const namaGrup = meta?.subject || "grup ini";

      // Ambil template welcome dari settings
      let pesanWelcome = settings.welcome || `Selamat datang @user di ${namaGrup}! 👋`;

      // Ganti placeholder
      pesanWelcome = pesanWelcome
        .replace(/@user/gi, `@${nomorUser}`)
        .replace(/@grup/gi, namaGrup);

      // Tambahkan rules di bawah welcome jika ada
      let pesanLengkap = pesanWelcome;
      if (settings.rules && settings.rules.trim()) {
        pesanLengkap += `\n\n${settings.rules}`;
      }

      const mentions = [participantJid];

      if (settings.welcomeGambar) {
        // Kirim dengan gambar
        const buffer = Buffer.from(settings.welcomeGambar, "base64");
        await sock.sendMessage(id, {
          image: buffer,
          caption: pesanLengkap,
          mentions,
        });
      } else {
        // Kirim teks biasa dengan mention
        await sendTextMention(sock, id, pesanLengkap, mentions);
      }
    } catch (err) {
      logError("welcome", err.message);
    }
  }
}
