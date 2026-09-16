"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Check, Clock, Wifi, WifiOff } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRupiah, STATUS_ORDER, STATUS_LABEL, type StatusKey } from "@/lib/format";
import { useOrderStatusStream } from "@/lib/use-order-status-stream";
import type { OrderDto } from "@/lib/types";

/**
 * Safety-net REST poll while waiting for the SSE stream to prove itself.
 * Once the first live SSE frame arrives (`live`), polling stops entirely —
 * the heartbeat watchdog in useOrderStatusStream handles dead sockets and
 * restarts polling only while the stream is actually down.
 */
const INITIAL_POLL_MS = 4000;

export default function TrackingClient({
  initialOrder,
  orderId,
  token,
}: {
  initialOrder: OrderDto | null;
  orderId: number;
  token: string;
}) {
  // Server-provided data: the page is fully rendered before any JS runs.
  const [order, setOrder] = React.useState<OrderDto | null>(initialOrder);
  const [error, setError] = React.useState<string | null>(null);
  const [live, setLive] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const [done, setDone] = React.useState(initialOrder?.status === "selesai");

  // ponytail: track which steps JUST got checked by a real-time update so the
  // checkmark can replay its pop animation — without this, React reuses the
  // same <Check> element and an SSE status change would feel instant/stiff.
  // Only the initial mount is excluded (SSR renders no icons → no hydration
  // mismatch); re-pops on later remounts are a fair trade for liveliness.
  const [justChecked, setJustChecked] = React.useState<number>(-1);
  const firstStatusRef = React.useRef(true);
  React.useEffect(() => {
    if (!order) return;
    if (firstStatusRef.current) {
      firstStatusRef.current = false;
      return;
    }
    const idx = STATUS_ORDER.indexOf(order.status as StatusKey);
    if (idx >= 0) setJustChecked(idx);
  }, [order?.status]); // eslint-disable-line react-hooks/exhaustive-deps -- hanya status yang memicu pop

  // Safety-net poll: only until the SSE stream proves itself live; never for
  // a finished order (nothing can change anymore).
  React.useEffect(() => {
    if (done || live) return;
    let alive = true;

    async function fetchOrder() {
      try {
        const qs = token ? `?token=${encodeURIComponent(token)}` : "";
        const res = await fetch(`/api/orders/${orderId}${qs}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Gagal memuat pesanan");
        if (alive) {
          setOrder(json.order);
          setError(null);
          if (json.order.status === "selesai") setDone(true);
        }
      } catch {
        if (alive) setError("Tidak dapat memuat status. Periksa di kasir.");
      }
    }

    const t = setInterval(fetchOrder, INITIAL_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [orderId, token, done, live]);

  // Real-time status push — token-gated SSE, auto-closes on "selesai".
  useOrderStatusStream({
    orderId,
    orderToken: token || undefined,
    enabled: !done,
    onEvent: React.useCallback((status: string) => {
      setError(null);
      setOrder((prev) => (prev ? { ...prev, status: status as OrderDto["status"] } : prev));
      if (status === "selesai") setDone(true);
    }, []),
    onLive: React.useCallback(() => {
      setLive(true);
      setDown(false);
    }, []),
    onDown: React.useCallback(() => {
      setDown(true);
      setLive(false); // the green "live" text must not linger during an outage
    }, []),
  });

  if (!order) {
    return (
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-base font-medium text-ink">Pesanan tidak ditemukan</p>
        <p className="text-sm text-muted">Periksa nomor pesananmu atau tanyakan ke kasir.</p>
        <Link href="/" className="text-sm font-medium text-primary underline underline-offset-4">
          Kembali ke menu
        </Link>
      </main>
    );
  }

  const currentStep = STATUS_ORDER.indexOf(order.status as StatusKey);

  return (
    <main className="mx-auto w-full max-w-[480px] flex-1 px-4 py-6">
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
          <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
        </span>
        <h1 className="text-[1.75rem] font-bold text-ink mt-4 text-balance">Pesanan Berhasil!</h1>
        <p className="text-sm text-muted mt-1">
          {order.customerName ? `Terima kasih, ${order.customerName}. ` : ""}Pesananmu sudah masuk ke dapur.
        </p>

        {/* Order number */}
        <div className="mt-6 w-full rounded-[var(--radius-lg)] border border-border bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted font-medium">Nomor Pesanan</p>
          <p className="text-4xl font-bold text-primary mt-1">#{order.orderNumber}</p>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={order.status} />
            <span className="text-xs text-muted">
              {order.tableNumber ? ` · Meja ${order.tableNumber}` : ""}
            </span>
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
            {done ? (
              "Pesanan selesai — terima kasih! Sudah tidak ada pembaruan status."
            ) : live ? (
              <>
                <Wifi className="live-pulse h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Pembaruan status langsung (real-time)
              </>
            ) : (
              "Memuat pembaruan status…"
            )}
          </p>
          {!done && down && (
            <p
              role="status"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-[var(--status-diproses)]"
            >
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              Koneksi terputus, mencoba lagi…
            </p>
          )}
          <p className="text-xs text-muted mt-1">
            {error
              ? "Koneksi bermasalah — status mungkin belum terbaru. Periksa di kasir."
              : "Simpan nomor ini dan tunjukkan saat mengambil pesanan."}
          </p>
        </div>
      </div>

      {/* Status timeline */}
      <section aria-label="Status pesanan" className="mt-6">
        <h2 className="text-sm font-semibold text-on-surface mb-2">Status</h2>
        <ol className="flex flex-col gap-0">
          {STATUS_ORDER.map((step, i) => {
            const doneStep = i < currentStep;
            const current = i === currentStep;
            return (
              <li key={step} className="relative flex gap-3 pb-4 last:pb-0">
                {/* connector */}
                {i < STATUS_ORDER.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`step-connector absolute left-[11px] top-6 h-full w-0.5 ${
                      i < currentStep ? "step-connector-filled bg-accent" : "bg-border"
                    }`}
                  />
                )}
                <span
                  className={`step-dot-done relative mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    doneStep
                      ? "border-accent bg-accent text-white"
                      : current
                        ? "step-pulse border-primary bg-white text-primary"
                        : "border-border bg-white text-muted"
                  }`}
                >
                  {doneStep ? (
                    <Check
                      key={`step-${i}-${justChecked}`}
                      className={`h-3.5 w-3.5 ${i === justChecked ? "check-pop" : ""}`}
                      aria-hidden="true"
                    />
                  ) : current ? (
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-border" />
                  )}
                </span>
                <div className="flex flex-col">
                  <span
                    className={`text-sm font-medium ${
                      doneStep || current ? "text-ink" : "text-muted"
                    }`}
                  >
                    {STATUS_LABEL[step as StatusKey]}
                  </span>
                  {current && !doneStep && (
                    <span className="text-xs text-muted">Sekitar 10 menit</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Item summary */}
      <section aria-label="Ringkasan pesanan" className="mt-6">
        <h2 className="text-sm font-semibold text-on-surface mb-2">Pesananmu</h2>
        <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface px-4 py-1">
          {order.items.map((it) => {
            let specs: string[] = [];
            try {
              if (Array.isArray(JSON.parse(it.customization))) specs = JSON.parse(it.customization);
            } catch {
              specs = [];
            }
            return (
              <li key={it.id} className="py-2.5 flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {it.itemName} <span className="text-muted">×{it.quantity}</span>
                  </p>
                  {specs.length > 0 && (
                    <p className="text-xs text-muted truncate mt-0.5">{specs.join(" · ")}</p>
                  )}
                </div>
                <span className="font-semibold text-on-surface shrink-0">{formatRupiah(it.subtotal)}</span>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-sm font-medium text-on-surface">Total</span>
          <span className="text-base font-bold text-ink">{formatRupiah(order.totalPrice)}</span>
        </div>
        <p className="text-xs text-muted mt-1 px-1">Bayar di kasir saat mengambil pesanan.</p>
      </section>

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm font-medium text-primary underline underline-offset-4">
          Pesan menu lain
        </Link>
      </div>
    </main>
  );
}
