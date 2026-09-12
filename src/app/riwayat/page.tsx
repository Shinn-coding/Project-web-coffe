"use client";

import { useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRupiah, STATUS_COLOR, STATUS_LABEL } from "@/lib/format";
import { addOrderToHistory, getOrderHistory, OrderHistoryEntry } from "@/lib/order-history";
import { OrderDto, OrderItemDto } from "@/lib/types";

const POLL_MS = 5000;

function OrderEntry({ entry }: { entry: OrderHistoryEntry }) {
  const [data, setData] = useState<OrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry.id) {
      setError("Tidak dapat memuat status. Periksa di kasir.");
      return;
    }

    let alive = true;

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${entry.id}?token=${encodeURIComponent(entry.orderToken)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Gagal memuat pesanan");
        if (alive) setData(json.order);
      } catch {
        if (alive) setError("Tidak dapat memuat status. Periksa di kasir.");
      }
    }

    fetchOrder();
    const t = setInterval(fetchOrder, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [entry.id, entry.orderNumber, entry.orderToken]);

  return (
    <li className="rounded-2xl border border-surface-2 bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{entry.orderNumber}</p>
        {data ? (
          <StatusBadge status={data.status} />
        ) : error ? (
          <p className="text-xs text-muted">{error}</p>
        ) : (
          <Spinner size={14} />
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-xs text-muted">
        <p>
          {new Date(entry.timestamp).toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        {data && (
          <p className="font-medium text-ink">
            {data.status === "selesai"
              ? formatRupiah(data.totalPrice)
              : `${data.items.reduce((sum, it) => sum + it.quantity, 0)} item · ${formatRupiah(data.totalPrice)}`}
          </p>
        )}
      </div>

      {data && data.items.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-surface-2 pt-3">
          {data.items.map((it) => {
            let specs: string[] = [];
            try {
              const raw = JSON.parse(it.customization ?? "");
              if (Array.isArray(raw)) {
                specs = raw.map((line) => String(line));
              }
            } catch {
              // invalid customization -> fall back to default
            }

            return (
              <li key={it.id} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-ink">
                  {it.itemName} <span className="text-muted">×{it.quantity}</span>
                </span>
                <span className="text-muted">{specs.length > 0 ? specs.join(" · ") : "Tanpa tambahan"}</span>
                <span className="font-medium text-ink">{formatRupiah(it.subtotal)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export default function RiwayatPage() {
  const [entries, setEntries] = useState<OrderHistoryEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEntries(getOrderHistory());
    setMounted(true);
  }, []);

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-8">
      <div className="flex items-center gap-2 text-sm text-muted">
        <a href="/" className="hover:text-ink">
          ← Kembali ke Menu
        </a>
      </div>

      <h1 className="mt-4 text-2xl font-bold text-ink">Riwayat Pesanan Saya</h1>

      {!mounted ? (
        <div className="mt-12 text-center">
          <p className="text-sm text-muted">Memuat riwayat...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-sm text-muted">Belum ada pesanan.</p>
          <a
            href="/"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-white hover:opacity-90"
          >
            Kembali ke Menu
          </a>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((entry) => (
            <OrderEntry key={entry.orderNumber} entry={entry} />
          ))}
        </ul>
      )}
    </main>
  );
}