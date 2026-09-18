"use client";

import * as React from "react";
import { Moon, RefreshCw, Eye, Lock, X } from "lucide-react";

/** "HH:mm" → "08.00" for display */
function fmt(hhmm: string): string {
  return hhmm.replace(":", ".");
}

/** Milidetik sampai openHour berikutnya (hari ini, atau besok kalau sudah lewat) */
function msUntilOpen(openHour: string, now: Date): number {
  const [h, m] = openHour.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

/**
 * Overlay fullscreen saat warung tutup (sebelum pelanggan memilih):
 * - pesan maaf + jam buka + countdown live ke jam buka
 * - animasi uap kopi, bulan, aura berputar
 * - "Lihat menu saja" → masuk mode lihat-lihat (menu terlihat, order terkunci)
 * - "Cek status" → re-fetch settings tanpa reload
 */
export function ClosedOverlay({
  openHour,
  closeHour,
  onBrowse,
  onRecheck,
}: {
  openHour: string;
  closeHour: string;
  onBrowse: () => void;
  onRecheck: () => void;
}) {
  const [remaining, setRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    // guard mount: mulai hitung setelah render di client
    setRemaining(msUntilOpen(openHour, new Date()));
    const t = setInterval(() => setRemaining(msUntilOpen(openHour, new Date())), 1000);
    return () => clearInterval(t);
  }, [openHour]);

  // Kunci scroll body selama overlay tampil
  React.useEffect(() => {
    document.body.classList.add("closed-lock");
    return () => document.body.classList.remove("closed-lock");
  }, []);

  const p = remaining !== null ? parts(remaining) : null;
  const tomorrow = remaining !== null && remaining > 24 * 3600 * 1000;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Warung sedang tutup"
      className="fixed inset-0 z-[var(--z-toast)] bg-bg/95 backdrop-blur-sm flex items-center justify-center px-6 page-enter"
    >
      {/* Aura berputar lembut di belakang cangkir */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="aura-spin h-[420px] w-[420px] rounded-full opacity-30"
          style={{
            background:
              "conic-gradient(from 0deg, transparent, color-mix(in oklch, var(--primary) 18%, transparent), transparent 40%, color-mix(in oklch, var(--accent) 14%, transparent), transparent 80%)",
            filter: "blur(48px)",
          }}
        />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center text-center gap-4">
        {/* Bulan — tanda malam/tutup, dengan uap kopi mengepul */}
        <div className="moon-rise relative">
          <div className="relative inline-flex h-24 w-24 items-center justify-center rounded-full bg-surface-2 border border-border shadow-[var(--shadow-lg)]">
            <span aria-hidden="true" className="steam absolute -top-2 left-1/2 -ml-3 h-6 w-1 rounded-full bg-muted/40 [--steam-x:-8px]" />
            <span aria-hidden="true" className="steam absolute -top-2 left-1/2 h-7 w-1 rounded-full bg-muted/50 [--steam-delay:0.9s] [--steam-x:2px]" />
            <span aria-hidden="true" className="steam absolute -top-2 left-1/2 ml-2 h-5 w-1 rounded-full bg-muted/40 [--steam-delay:1.7s] [--steam-x:10px]" />
            <Moon className="h-10 w-10 text-primary" aria-hidden="true" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-bold text-ink text-balance">Maaf, kami sedang tutup</h2>
          <p className="text-sm text-muted text-balance">
            Datang kembali besok yah untuk memesan. Terima kasih!
          </p>
          <p className="text-sm font-medium text-on-surface">
            Jam buka: {fmt(openHour)} – {fmt(closeHour)} WIB
          </p>
        </div>

        {/* Countdown live ke jam buka */}
        {p && !tomorrow && (
          <div className="countdown-in flex items-center gap-2" aria-live="polite">
            {[
              { v: p.h, l: "jam" },
              { v: p.m, l: "menit" },
              { v: p.s, l: "detik" },
            ].map(({ v, l }) => (
              <div
                key={l}
                className="min-w-[64px] rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2"
              >
                <p className="text-xl font-bold text-ink tabular-nums">{String(v).padStart(2, "0")}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted">{l}</p>
              </div>
            ))}
          </div>
        )}
        {tomorrow && (
          <p className="countdown-in text-sm text-muted">Buka lagi besok pukul {fmt(openHour)}</p>
        )}

        <div className="mt-2 flex flex-col gap-2 w-full sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onBrowse}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Eye className="h-4 w-4" aria-hidden="true" /> Lihat menu saja
          </button>
          <button
            type="button"
            onClick={onRecheck}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 text-sm font-semibold text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Cek status
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Banner kecil mode lihat-lihat: menu tetap bisa dilihat & dicari,
 * tapi tombol pesan terkunci sampai jam buka.
 */
export function ClosedBrowseBar({
  openHour,
  onExit,
}: {
  openHour: string;
  onExit: () => void;
}) {
  const [remaining, setRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    setRemaining(msUntilOpen(openHour, new Date()));
    const t = setInterval(() => setRemaining(msUntilOpen(openHour, new Date())), 30_000);
    return () => clearInterval(t);
  }, [openHour]);

  const p = remaining !== null ? parts(remaining) : null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] flex justify-center px-3 pb-3 pointer-events-none"
    >
      <div className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-full bg-ink text-white pl-4 pr-1.5 py-1.5 text-xs shadow-[var(--shadow-lg)] animate-in fade-in-0 slide-in-from-bottom-2">
        <Lock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
        <span className="truncate">
          Mode lihat-lihat — order terbuka{p ? ` dalam ${p.h}j ${p.m}m` : ""}
        </span>
        <button
          type="button"
          onClick={onExit}
          aria-label="Kembali ke layar tutup"
          className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
