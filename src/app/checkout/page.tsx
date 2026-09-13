"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatRupiah } from "@/lib/format";
import { useCart, cartCount, cartSubtotal } from "@/lib/store/cart";
import { addOrderToHistory } from "@/lib/order-history";

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);

  const [name, setName] = useState("");
  const [table, setTable] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const count = cartCount(items);
  const subtotal = cartSubtotal(items);

  // Empty cart → back to menu
  useEffect(() => {
    if (count === 0 && !submitting) router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Nama wajib diisi");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: { customerName: string; tableNumber?: string; items: unknown[] } = {
        customerName: name.trim(),
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          selection: i.selection,
        })),
      };
      if (table.trim()) payload.tableNumber = table.trim();

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal mengirim pesanan");
clear();
        addOrderToHistory(json.order.id, json.order.orderNumber, json.orderToken);
        router.push(`/order/${json.order.id}?token=${json.orderToken}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Terjadi kesalahan. Coba lagi.");
      setSubmitting(false);
    }
  }

  if (count === 0) return null;

  return (
    <main className="mx-auto w-full max-w-[480px] flex-1 px-4 py-4">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke menu
      </button>

      <h1 className="text-[1.75rem] font-bold text-ink mt-3 text-balance">Checkout</h1>
      <p className="text-sm text-muted mt-1">Pembayaran dilakukan di kasir setelah pesanan dibuat.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
        {/* Order summary */}
        <section aria-label="Ringkasan pesanan" className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="h-4 w-4 text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-on-surface">Ringkasan ({count} item)</h2>
          </div>
          <ul className="divide-y divide-border/70">
            {items.map((i) => (
              <li key={i.key} className="py-2 flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {i.name} <span className="text-muted">×{i.quantity}</span>
                  </p>
                  {i.spec.length > 0 && (
                    <p className="text-xs text-muted truncate mt-0.5">{i.spec.join(" · ")}</p>
                  )}
                </div>
                <span className="font-semibold text-on-surface shrink-0">
                  {formatRupiah(i.unitPrice * i.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-sm font-medium text-on-surface">Subtotal</span>
            <span className="text-base font-bold text-ink">{formatRupiah(subtotal)}</span>
          </div>
        </section>

        {/* Customer info */}
        <section aria-label="Data pemesan" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-on-surface">
              Nama <span className="text-status-error" aria-hidden="true">*</span>
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="Nama kamu"
              error={!!nameError}
              autoComplete="name"
            />
            {nameError && (
              <p className="text-sm text-status-error" role="alert">{nameError}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="table" className="text-sm font-medium text-on-surface">
              Nomor Meja <span className="text-muted font-normal">(opsional)</span>
            </label>
            <Input
              id="table"
              value={table}
              onChange={(e) => setTable(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Contoh: 4"
              inputMode="numeric"
            />
          </div>
        </section>

        {submitError && (
          <p className="rounded-[var(--radius-sm)] bg-status-error/10 border border-status-error/30 px-3 py-2 text-sm text-status-error" role="alert">
            {submitError}
          </p>
        )}

        <Button type="submit" size="lg" disabled={submitting || !name.trim()}>
          {submitting && <Spinner size={16} />}
          {submitting ? "Mengirim…" : `Kirim Pesanan • ${formatRupiah(subtotal)}`}
        </Button>
      </form>
    </main>
  );
}