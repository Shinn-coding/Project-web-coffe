/**
 * Durasi idle sebelum kasir/admin di-logout otomatis: 60 MENIT.
 *
 * Timer di-reset oleh dua sumber (lihat IdleLogout):
 *  1. Aktivitas kasir (klik/ketik/mouse/scroll)
 *  2. Order baru masuk via SSE — toko yang sedang menerima order dianggap aktif
 *
 * Dipakai bersama oleh komponen idle-logout dan admin layout (untuk info
 * "sesi berakhir dalam X menit" di layar login), jadi durasinya cukup diubah
 * di satu tempat ini.
 */
export const ADMIN_IDLE_TIMEOUT_MS = 60 * 60 * 1000;

/** Label ringkas untuk teks UI — diambil dari konstanta di atas biar tidak keroyokan. */
export const ADMIN_IDLE_MINUTES = ADMIN_IDLE_TIMEOUT_MS / 60_000;
