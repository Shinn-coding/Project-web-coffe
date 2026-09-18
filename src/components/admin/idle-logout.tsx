"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_IDLE_TIMEOUT_MS } from "@/lib/idle-timeout";

/** Aktivitas kasir ini yang me-reset timer idle (dibersihkan saat unmount). */
const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
  "visibilitychange",
] as const;

/** Seberapa sering timer idle dicek — 30 detik cukup presisi untuk timeout 60 menit. */
const CHECK_INTERVAL_MS = 30_000;

/**
 * Auto-logout idle 60 menit.
 *
 * Timer berhenti (di-reset) kalau SALAH SATU dari:
 *  1. Ada aktivitas kasir (klik, ketik, gerak mouse, scroll, tab kembali aktif)
 *  2. Event `new-order` masuk lewat SSE `/api/admin/orders/stream` — artinya toko
 *     sedang aktif beroperasi, jadi kasir tidak boleh dibuang meski dia sedang
 *     tidak menyentuh komputer (kondisi sepi orderan yang jarang pun tetap aman
 *     dari "order nyasar" di jam sepi).
 *
 * Auto-logout HANYA terjadi kalau 60 menit penuh tanpa keduanya.
 */
export function IdleLogout() {
  const router = useRouter();
  // ⚠️ lastActivity di ref, bukan state — memperbarui ini terjadi puluhan kali per
  // menit saat kasir aktif; me-render ulang untuk setiap gerak mouse hanya membakar CPU.
  // Di-init 0 dan diisi Date.now() di effect (aturan purity: jangan panggil
  // fungsi impure saat render) — aman karena effect jalan sebelum tick pertama.
  const lastActivity = useRef(0);

  useEffect(() => {
    lastActivity.current = Date.now();

    function touch() {
      lastActivity.current = Date.now();
    }

    for (const ev of ACTIVITY_EVENTS) {
      document.addEventListener(ev, touch, { passive: true });
    }

    // Order baru masuk = toko aktif beroperasi → reset idle juga.
    const es = new EventSource("/api/admin/orders/stream");
    es.addEventListener("new-order", touch);

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current >= ADMIN_IDLE_TIMEOUT_MS) {
        // Bersihkan sumber daya lebih dulu, lalu keluar.
        clearInterval(interval);
        es.close();
        fetch("/api/admin/logout", { method: "POST" })
          .catch(() => {
            // Cookie mungkin sudah kedaluwarsa / jaringan mati — lanjut redirect saja.
          })
          .finally(() => {
            router.replace("/admin/login?reason=idle");
          });
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      es.close();
      for (const ev of ACTIVITY_EVENTS) {
        document.removeEventListener(ev, touch);
      }
    };
  }, [router]);

  // Komponen ini tidak merender apa pun — murni efek samping.
  return null;
}
