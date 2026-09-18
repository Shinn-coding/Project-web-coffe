"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, QrCode, Trash2, Plus, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Generator QR code per meja — bikin QR siap print yang isinya URL menu + ?meja=N.
 * QR-nya murni di-generate di browser (tidak ada data yang dikirim ke mana-mana),
 * jadi baseURL ikut device yang dipakai (mis. http://192.168.x.x:3000 saat testing).
 */
export default function AdminQrPage() {
  const [tables, setTables] = React.useState<number[]>([1]);
  const [draft, setDraft] = React.useState("");
  const [base, setBase] = React.useState("");

  React.useEffect(() => {
    setBase(window.location.origin);
  }, []);

  function addTables() {
    const parsed = draft
      .split(/[\s,]+/)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n > 0 && n <= 999);
    if (parsed.length === 0) return;
    setTables((prev) => Array.from(new Set([...prev, ...parsed])).sort((a, b) => a - b));
    setDraft("");
  }

  function addRange() {
    // Shortcut: isi "1-12" → generate 12 meja sekaligus
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(draft.trim());
    if (!m) return addTables();
    let from = Number.parseInt(m[1], 10);
    let to = Number.parseInt(m[2], 10);
    if (from > to) [from, to] = [to, from];
    if (to - from > 200) return;
    const range: number[] = [];
    for (let n = from; n <= to; n++) range.push(n);
    setTables((prev) => Array.from(new Set([...prev, ...range])).sort((a, b) => a - b));
    setDraft("");
  }

  function removeTable(n: number) {
    setTables((prev) => prev.filter((t) => t !== n));
  }

  function clearAll() {
    setTables([]);
    setDraft("");
  }

  const urlFor = (n: number) => `${base || window.location.origin}/?meja=${n}`;

  return (
    <div className="page-enter">
      <div className="flex items-center gap-2 print:hidden">
        <QrCode className="h-6 w-6 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-ink">QR Code Meja</h1>
      </div>
      <p className="text-sm text-muted mt-1 print:hidden">
        Bikin QR per meja, print, lalu tempel di meja. Saat discan, pelanggan buka menu dan nomor
        meja terisi otomatis di checkout.
      </p>

      {/* Controls — hidden when printing */}
      <section aria-label="Pengaturan QR" className="mt-6 print:hidden">
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted mb-1">
              URL dasar (otomatis dari device ini)
            </p>
            <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="http://192.168.x.x:3000" />
            <p className="text-xs text-muted mt-1">
              Pakai IP/network yang sama dengan WiFi pelanggan. Setelah deploy ke domain, ganti ke
              domain final lalu print ulang QR-nya.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted mb-1">
              Nomor meja — bisa beberapa (pisah koma) atau rentang, mis. <code>1-12</code>
            </p>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/[^\d,\-\s]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRange();
                  }
                }}
                placeholder="Contoh: 1, 2, 3 atau 1-12"
                inputMode="numeric"
              />
              <Button type="button" variant="secondary" onClick={addRange}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Tambah
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => window.print()} disabled={tables.length === 0}>
              <Printer className="h-4 w-4" aria-hidden="true" /> Print {tables.length} QR
            </Button>
            {tables.length > 0 && (
              <Button type="button" variant="secondary" onClick={clearAll}>
                <Trash className="h-4 w-4" aria-hidden="true" /> Delete All
              </Button>
            )}
          </div>
          {tables.length > 0 && (
            <p className="text-xs text-muted">
              Delete All hanya menghapus daftar QR di layar ini — QR yang sudah di-print tidak terpengaruh.
            </p>
          )}
        </div>
      </section>

      {/* QR grid */}
      {tables.length === 0 ? (
        <p className="text-sm text-muted mt-8 print:hidden">
          Belum ada meja. Tambahkan nomor meja di atas untuk membuat QR.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((n) => (
            <div
              key={n}
              className="qr-card relative rounded-[var(--radius-md)] border border-border bg-white p-4 flex flex-col items-center gap-3 text-center"
            >
              <button
                type="button"
                aria-label={`Hapus QR meja ${n}`}
                onClick={() => removeTable(n)}
                className="absolute right-2 top-2 rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-status-error transition-colors cursor-pointer print:hidden"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
              <QRCodeSVG value={urlFor(n)} size={140} marginSize={2} aria-label={`QR meja ${n}`} />
              <div>
                <p className="text-lg font-bold text-ink leading-tight">Meja {n}</p>
                <p className="text-xs text-muted break-all mt-0.5">Scan untuk memesan</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
