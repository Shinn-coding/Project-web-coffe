"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRupiah } from "@/lib/format";
import { isFinalOrderStatus } from "@/lib/format";
import {
  getOrderHistory,
  removeOrderFromHistory,
  pruneFinishedEntries,
  cacheOrderStatus,
  type OrderHistoryEntry,
} from "@/lib/order-history";
import { useOrderStatusStream } from "@/lib/use-order-status-stream";
import type { OrderDto } from "@/lib/types";

/**
 * Safety-net poll while waiting for the SSE stream to prove itself live.
 * Once live (or finished), polling stops — the SSE heartbeat watchdog in
 * useOrderStatusStream restarts polling only while the stream is down.
 */
const POLL_MS = 4000;

function OrderEntry({
  entry,
  index,
  onGone,
}: {
  entry: OrderHistoryEntry;
  index: number;
  onGone: () => void;
}) {
  const [data, setData] = useState<OrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [live, setLive] = useState(false); // SSE frame received
  const [alive, setAlive] = useState(false); // entry confirmed on the server
  const [pressed, setPressed] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const finishedRef = useRef(false);
  const liveRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    finishedRef.current = finished;
  }, [finished]);
  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  const applyStatus = useCallback(
    (status: string) => {
      setData((prev) => (prev ? { ...prev, status: status as OrderDto["status"] } : prev));
      cacheOrderStatus(entry.orderNumber, status);
      if (isFinalOrderStatus(status)) setFinished(true);
    },
    [entry.orderNumber],
  );

  // Real-time status push — token-gated SSE for THIS order only, auto-closes
  // on "selesai". Enabled once the entry is confirmed alive; disabled once
  // finished so no connection/poll keeps running for a done order.
  useOrderStatusStream({
    orderId: entry.id,
    orderToken: entry.orderToken,
    enabled: alive && !finished,
    onEvent: applyStatus,
    onLive: useCallback(() => setLive(true), []),
  });

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
          setAlive(true);
          cacheOrderStatus(entry.orderNumber, json.order.status);
          // status may have become final (selesai/dibatalkan) between renders
          if (isFinalOrderStatus(json.order.status)) setFinished(true);
        }
      } catch (err) {
        // ponytail: log the real cause — a bare generic message hid the 404s before
        console.error(`[riwayat] gagal memuat status #${entry.orderNumber} (id=${entry.id}):`, err);
        if (alive) setError("Tidak dapat memuat status. Periksa di kasir.");
      }
    }

    fetchOrder();

    // Safety-net poll ONLY until the first server confirmation or a live SSE
    // frame; afterwards SSE (with its watchdog) owns freshness. A finished
    // order never polls again.
    let t: ReturnType<typeof setInterval> | null = null;
    if (!finished) {
      t = setInterval(() => {
        if (finishedRef.current || liveRef.current) {
          if (t) clearInterval(t);
          return;
        }
        void fetchOrder();
      }, POLL_MS);
    }
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
    // `finished`/`live` intentionally not in deps: the refs below track them
    // without tearing down the interval on every status change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ponytail: guard klik ganda — hanya entry valid dengan id yang boleh navigasi.
  // Order "selesai" tetap bisa dibuka (read-only, SSE-nya memang sudah off),
  // order aktif akan tersambung real-time lagi di halaman tracking.
  const openTracking = useCallback(() => {
    if (!entry.id || navigating) return;
    setNavigating(true);
    router.push(`/order/${entry.id}?token=${encodeURIComponent(entry.orderToken)}`);
  }, [entry.id, entry.orderToken, navigating, router]);

  const interactive = Boolean(entry.id) && !navigating;

  return (
    <li
      className={`card-enter group rounded-2xl border bg-surface transition-[transform,box-shadow,background-color,border-color,opacity] duration-200 ease-out ${
        pressed ? "scale-[0.98] border-primary/30" : ""
      } ${
        interactive
          ? "cursor-pointer border-surface-2 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-2/60 hover:shadow-lg active:bg-surface-2"
          : "border-surface-2"
      } ${navigating ? "opacity-60" : ""}`}
      style={{ "--enter-delay": `${Math.min(index, 8) * 60}ms` } as CSSProperties}
      role={interactive ? "link" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Buka pelacakan pesanan ${entry.orderNumber}` : undefined}
      onClick={interactive ? openTracking : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openTracking();
              }
            }
          : undefined
      }
      onPointerDown={interactive ? () => setPressed(true) : undefined}
      onPointerUp={interactive ? () => setPressed(false) : undefined}
      onPointerLeave={interactive ? () => setPressed(false) : undefined}
      onPointerCancel={interactive ? () => setPressed(false) : undefined}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-ink">{entry.orderNumber}</p>
          <div className="flex items-center gap-1.5">
            {data ? (
              <StatusBadge status={data.status} />
            ) : error ? (
              <p className="text-xs text-muted">{error}</p>
            ) : (
              <Spinner size={14} />
            )}
            {interactive && (
              <ChevronRight
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${
                  navigating ? "translate-x-0.5 text-primary" : "group-hover:translate-x-0.5"
                }`}
              />
            )}
          </div>
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
      </div>
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

    // ponytail: pruneFinishedEntries() reads statuses from storage — OrderEntry
    // keeps them fresh via SSE (poll fallback), so a 60s sweep is enough for
    // auto-delete after selesai.
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
          {entries.map((entry, index) => (
            <OrderEntry key={entry.orderNumber} entry={entry} index={index} onGone={handleGone} />
          ))}
        </ul>
      )}
    </main>
  );
}
