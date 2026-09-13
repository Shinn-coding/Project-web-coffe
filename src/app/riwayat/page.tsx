"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRupiah } from "@/lib/format";
import {
  getOrderHistory,
  removeOrderFromHistory,
  pruneFinishedEntries,
  cacheOrderStatus,
  type OrderHistoryEntry,
} from "@/lib/order-history";
import type { OrderDto } from "@/lib/types";

const POLL_MS = 5000;

function OrderEntry({ entry, onGone }: { entry: OrderHistoryEntry; onGone: () => void }) {
  const [data, setData] = useState<OrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry.id) {
      // ponytail: entry dari format localStorage lama (sebelum migrasi) tidak punya
      // id — tidak mungkin di-fetch, jadi buang langsung dari riwayat, sama seperti
      // entry yang 404 dari server. Jangan biarkan tergantung dengan error statis.
      console.warn(`[riwayat] entry #${entry.orderNumber} tanpa id (format lama) — entry dibersihkan`);
      removeOrderFromHistory(entry.orderNumber);
      onGone();
      return;
    }

    let alive = true;

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${entry.id}?token=${encodeURIComponent(entry.orderToken)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (alive) {
          setData(json.order);
          setError(null);
          cacheOrderStatus(entry.orderNumber, json.order.status);
        }
      } catch (err) {
        // ponytail: log the real cause — a bare generic message hid the 404s before
        console.error(`[riwayat] gagal memuat status #${entry.orderNumber} (id=${entry.id}):`, err);
        if (alive) setError("Tidak dapat memuat status. Periksa di kasir.");
      }
    }

    fetchOrder();
    const t = setInterval(fetchOrder, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [entry.id, entry.orderNumber, entry.orderToken, onGone]);

  // ponytail: a 404 with a correct token means the order is gone from the DB
  // (e.g. dev DB reset). Clear the stale entry so the user stops seeing the
  // error on every visit — a failed fetch must NOT delete anything.
  useEffect(() => {
    if (!error || data !== null || !entry.id) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${entry.id}?token=${encodeURIComponent(entry.orderToken)}`);
        if (alive && res.status === 404) {
          console.warn(`[riwayat] pesanan #${entry.orderNumber} tidak ada di database — entry dibersihkan`);
          removeOrderFromHistory(entry.orderNumber);
          onGone();
        }
      } catch {
        // network hiccup — keep the entry, next poll retries
      }
    })();
    return () => {
      alive = false;
    };
  }, [error, data, entry.id, entry.orderNumber, entry.orderToken, onGone]);

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

    // Re-read storage when a stale entry was removed by a child (404 pruning)
    const refresh = () => setEntries(getOrderHistory());
    const prune = () => {
      pruneFinishedEntries();
      refresh();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") prune();
    };
    document.addEventListener("visibilitychange", onVisible);

    // ponytail: pruneFinishedEntries() reads statuses from storage — OrderEntry polls
    // keep them fresh every 5s, so a 60s sweep is enough for auto-delete after selesai.
    const interval = setInterval(prune, 60_000);
    prune(); // drop entries already past 5 minutes on load

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);

  // ponytail: stable callback — tanpa ini tiap render parent membuat onGone baru
  // dan me-restart polling di tiap OrderEntry (deps effect memuat onGone).
  const handleGone = useCallback(() => {
    setEntries(getOrderHistory());
  }, []);

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-8">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          ← Kembali ke Menu
        </Link>
      </div>

      <h1 className="mt-4 text-2xl font-bold text-ink">Riwayat Pesanan Saya</h1>

      {!mounted ? (
        <div className="mt-12 text-center">
          <p className="text-sm text-muted">Memuat riwayat...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-sm text-muted">Belum ada pesanan.</p>
          <Link
            href="/"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-white hover:opacity-90"
          >
            Kembali ke Menu
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((entry) => (
            <OrderEntry key={entry.orderNumber} entry={entry} onGone={handleGone} />
          ))}
        </ul>
      )}
    </main>
  );
}
