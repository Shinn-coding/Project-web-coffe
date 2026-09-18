"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { effectiveShopInfo, type EffectiveShopInfo } from "@/lib/settings";
import type { OrderDto } from "@/lib/types";

/* eslint-disable @next/next/no-img-element -- struk dirender via portal print; fixed-height <img> lebih andal daripada next/image fill di kertas */

/** Parse snapshot kustomisasi (JSON string array) → baris teks */
function parseSpecs(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function ReceiptItems({ order, showPrices }: { order: OrderDto; showPrices: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {order.items.map((it) => (
        <li key={it.id} className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-bold">
              {it.quantity}× {it.itemName}
            </p>
            {parseSpecs(it.customization).length > 0 && (
              <p className="text-xs">{parseSpecs(it.customization).join(" · ")}</p>
            )}
          </div>
          {showPrices && <span className="shrink-0 font-semibold">{formatRupiah(it.subtotal)}</span>}
        </li>
      ))}
    </ul>
  );
}

function ReceiptHeader({ order }: { order: OrderDto }) {
  return (
    <p className="text-sm">
      #{order.orderNumber} · {order.customerName ?? "Guest"}
      {order.tableNumber ? ` · Meja ${order.tableNumber}` : ""}
    </p>
  );
}

/**
 * Isi struk dapur (tanpa harga) — dipakai di layar & di kertas.
 * Dapur tidak perlu tahu harga/kasir/alamat — biar tetap ringkas.
 */
export function KitchenTicket({ order }: { order: OrderDto }) {
  return (
    <div className="kitchen-ticket rounded-[var(--radius-md)] border border-border bg-white p-4 text-sm text-ink">
      <div className="text-center">
        <p className="text-lg font-bold">STRUK DAPUR</p>
        <ReceiptHeader order={order} />
        <p className="border-t border-dashed border-border my-2" />
      </div>
      <ReceiptItems order={order} showPrices={false} />
    </div>
  );
}

/**
 * Isi struk customer (dengan harga & total) — dipakai di layar & di kertas.
 *
 * Struktur (dirancang untuk kertas thermal 80mm):
 *   logo/wordmark → alamat + kontak → dashed → info pesanan (+ kasir) →
 *   item → dashed → Subtotal → (pajak/service bila nanti ada) → TOTAL →
 *   dashed → terima kasih + kritik/saran + nomor struk (footer)
 */
export function CustomerReceipt({
  order,
  cashierName,
  shop,
}: {
  order: OrderDto;
  cashierName?: string | null;
  /** Identitas toko (DB admin + fallback SHOP_INFO). Default: fallback saja. */
  shop?: EffectiveShopInfo;
}) {
  const info = shop ?? effectiveShopInfo(null);
  const d = new Date(order.createdAt);
  const jam = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const tanggal = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  // Subtotal = jumlah subtotal per item. Saat ini belum ada pajak/service charge,
  // jadi Total = Subtotal — tapi keduanya tetap tampil terpisah supaya struktur
  // struk sudah siap kalau nanti ditambahkan (tinggal sisipkan baris di antaranya).
  const subtotal = order.items.reduce((sum, it) => sum + it.subtotal, 0);

  return (
    <div className="receipt-print rounded-[var(--radius-md)] border border-border bg-white p-4 text-sm text-ink">
      {/* ── Header: logo + wordmark + alamat + kontak ── */}
      <div className="text-center">
        {info.logoUrl && (
          <img
            src={info.logoUrl}
            alt={`Logo ${info.name}`}
            className="receipt-logo mx-auto mb-1.5 h-14 w-auto max-w-[70%] object-contain"
          />
        )}
        <p className="text-base font-bold tracking-wide">{info.name.toUpperCase()}</p>
        <p className="text-xs leading-snug">{info.address}</p>
        <p className="text-xs">Telp/WA: {info.phone}</p>
        <p className="border-t border-dashed border-border my-2" />
        <p className="text-xs">
          {tanggal} · {jam}
        </p>
        <ReceiptHeader order={order} />
        {cashierName && <p className="text-xs">Kasir: {cashierName}</p>}
        <p className="border-t border-dashed border-border my-2" />
      </div>

      {/* ── Item + harga per item ── */}
      <ReceiptItems order={order} showPrices />

      {/* ── Breakdown harga: Subtotal dan Total pada baris terpisah ── */}
      <p className="border-t border-dashed border-border my-2" />
      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{formatRupiah(subtotal)}</span>
      </div>
      {/* Slot siap pakai kalau nanti ada pajak / service charge:
          <div className="flex justify-between text-sm"><span>PDP 10%</span><span>…</span></div> */}
      <p className="border-t border-dashed border-border my-2" />
      <div className="flex justify-between text-base font-bold">
        <span>TOTAL</span>
        <span>{formatRupiah(order.totalPrice)}</span>
      </div>

      {/* ── Footer ── */}
      <p className="border-t border-dashed border-border my-2" />
      <p className="text-center text-xs">Terima kasih! Simpan struk ini sebagai bukti pesanan.</p>
      <p className="text-center text-xs">Kritik & saran: {info.phone}</p>
      <p className="text-center text-[10px] text-muted">No. {order.orderNumber} · {tanggal}</p>
    </div>
  );
}

/**
 * Salinan struk untuk kertas: dirender via portal langsung di bawah <body>
 * (di luar layout admin) ke dalam wadah .print-only yang hanya tampil saat print.
 * Ini yang menjamin kertas TIDAK kosong — isinya pohon React sendiri, bukan
 * hasil manipulasi visibility atas DOM modal.
 */
function PaperCopy({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="print-only" aria-hidden="true">
      {children}
    </div>,
    document.body
  );
}

/**
 * Modal pratinjau struk (dapur/customer) + print.
 * kind "kitchen" → tanpa harga, buat dapur. kind "customer" → dengan harga & total,
 * buat dikasihkan ke pelanggan.
 *
 * Nama kasir diambil dari sesi yang login SAAT struk dicetak (GET /api/admin/session).
 */
export function ReceiptTicketModal({
  order,
  kind,
  onClose,
}: {
  order: OrderDto;
  kind: "kitchen" | "customer";
  onClose: () => void;
}) {
  const [cashierName, setCashierName] = React.useState<string | null>(null);
  const [shop, setShop] = React.useState<EffectiveShopInfo | null>(null);

  React.useEffect(() => {
    if (kind !== "customer") return;
    let alive = true;
    fetch("/api/admin/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (alive && json?.user?.name) setCashierName(json.user.name);
      })
      .catch(() => {
        /* gagal fetch → bagian kasir saja tidak tampil, struk tetap valid */
      });
    // Identitas toko dari pengaturan admin (fallback SHOP_INFO bila gagal/kosong)
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (alive && json?.data) setShop(effectiveShopInfo(json.data.identity));
      })
      .catch(() => {
        /* gagal fetch → fallback ke SHOP_INFO, struk tetap valid */
      });
    return () => {
      alive = false;
    };
  }, [kind]);

  return (
    <>
      <div
        className="receipt-modal fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] w-full max-w-sm p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-ink">
              {kind === "kitchen" ? "Pratinjau Struk Dapur" : "Pratinjau Struk Customer"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-2 cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {kind === "kitchen" ? (
            <KitchenTicket order={order} />
          ) : (
            <CustomerReceipt order={order} cashierName={cashierName} shop={shop ?? undefined} />
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-fg hover:bg-primary-hover transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" aria-hidden="true" /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 inline-flex h-11 items-center justify-center rounded-full border border-border text-sm font-semibold text-ink hover:bg-surface-2 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Salinan untuk kertas — dirender di luar layout admin via portal */}
      <PaperCopy>
        {kind === "kitchen" ? (
          <KitchenTicket order={order} />
        ) : (
          <CustomerReceipt order={order} cashierName={cashierName} shop={shop ?? undefined} />
        )}
      </PaperCopy>
    </>
  );
}
