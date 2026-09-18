/** "HH:mm" → menit sejak tengah malam; null kalau format tidak valid */
export function toMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Inti hitungan buka/tutup dari menit — dipakai client (jam device) & server (WIB) */
export function isOpenAtMinutes(
  hours: { openHour: string; closeHour: string },
  minutes: number
): boolean {
  const open = toMinutes(hours.openHour);
  const close = toMinutes(hours.closeHour);
  if (open === null || close === null) return false; // pemanggil wajib cek toMinutes dulu
  // Mendukung rentang lewat tengah malam juga (mis. 20:00 → 02:00)
  return open <= close ? minutes >= open && minutes < close : minutes >= open || minutes < close;
}

/** Client-side: true = buka, false = tutup, null = jam belum diatur / format salah */
export function isOpenAt(
  hours: { openHour: string; closeHour: string },
  now: Date
): boolean | null {
  const open = toMinutes(hours.openHour);
  const close = toMinutes(hours.closeHour);
  if (open === null || close === null) return null;
  return isOpenAtMinutes(hours, now.getHours() * 60 + now.getMinutes());
}

/**
 * Server-side: menit sekarang di zona WIB (jam server bisa saja UTC/aset luar),
 * dipakai untuk menghitung status buka/tutup saat SSR.
 */
export function minutesWIB(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** SSR: status buka/tutup dengan jam WIB; null = banner jam tidak aktif */
export function isOpenNowWIB(
  hours: { openHour: string; closeHour: string } | null
): boolean | null {
  if (!hours) return null;
  if (toMinutes(hours.openHour) === null || toMinutes(hours.closeHour) === null) return null;
  return isOpenAtMinutes(hours, minutesWIB());
}
