"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowRight, BellRing } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToasts, ToastHost } from "@/components/ui/toast";
import { formatRupiah, nextStatus, STATUS_LABEL, type StatusKey } from "@/lib/format";
import type { OrderDto } from "@/lib/types";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState<number | null>(null);
  const knownIds = useRef<Set<number>>(new Set());
  const firstLoad = useRef(true);
  const pushToast = useToasts((s) => s.push);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal memuat pesanan");
      const list: OrderDto[] = json.data;

      // New-order pulse (skip on first load)
      if (!firstLoad.current) {
        for (const o of list) {
          if (o.status === "baru" && !knownIds.current.has(o.id)) {
            pushToast(`Pesanan baru #${o.orderNumber}!`);
          }
        }
      }
      knownIds.current = new Set(list.map((o) => o.id));
      firstLoad.current = false;

      setOrders(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pesanan");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const es = new EventSource("/api/admin/orders/stream");
    es.addEventListener("new-order", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { id: string; orderNumber: string; status: string };
      knownIds.current.add(Number(data.id));
      if (data.status === "baru") pushToast(`Pesanan baru #${data.orderNumber}!`);
    });
    return () => es.close();
  }, [pushToast]);

  async function advance(o: OrderDto) {
    const next = nextStatus(o.status);
    if (!next) return;
    setAdvancing(o.id);
    try {
      const res = await fetch(`/api/admin/orders/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal mengubah status");
      setOrders((prev) => prev.map((p) => (p.id === o.id ? json.data : p)));
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Gagal mengubah status");
    } finally {
      setAdvancing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={24} className="text-primary" />
        <span className="sr-only">Memuat pesanan</span>
      </div>
    );
  }

  const active = orders.filter((o) => o.status !== "selesai");
  const done = orders.filter((o) => o.status === "selesai").slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-ink">Pesanan</h1>
        {active.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-baru/15 px-2.5 py-1 text-xs font-semibold text-status-baru">
            <BellRing className="h-3.5 w-3.5" aria-hidden="true" /> {active.length} aktif
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-[var(--radius-sm)] bg-status-error/10 border border-status-error/30 px-3 py-2 text-sm text-status-error" role="alert">
          {error}
        </p>
      )}

      {active.length === 0 && done.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          Belum ada pesanan.
        </p>
      ) : (
        <>
          {/* Active orders */}
          <section aria-label="Pesanan aktif">
            <h2 className="text-sm font-semibold text-on-surface mb-2">Sedang Diproses</h2>
            <ul className="flex flex-col gap-3">
              {active.map((o) => {
                const next = nextStatus(o.status);
                return (
                  <li
                    key={o.id}
                    className="rounded-[var(--radius-md)] border border-border bg-surface p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-lg font-bold text-primary">#{o.orderNumber}</p>
                        <p className="text-sm text-on-surface">
                          {o.customerName}
                          {o.tableNumber ? ` · Meja ${o.tableNumber}` : ""}
                          <span className="text-muted"> · {formatRupiah(o.totalPrice)}</span>
                        </p>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                    <ul className="divide-y divide-border/70 rounded-[var(--radius-sm)] bg-bg px-3">
                      {o.items.map((it) => {
                        let specs: string[] = [];
                        try {
                          if (Array.isArray(JSON.parse(it.customization))) specs = JSON.parse(it.customization);
                        } catch {
                          specs = [];
                        }
                        return (
                          <li key={it.id} className="py-2 text-sm">
                            <p className="font-medium text-ink">
                              {it.itemName} <span className="text-muted">×{it.quantity}</span>
                            </p>
                            {specs.length > 0 && (
                              <p className="text-xs text-muted">{specs.join(" · ")}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {next && (
                      <button
                        type="button"
                        onClick={() => advance(o)}
                        disabled={advancing === o.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50 transition-colors cursor-pointer self-start"
                      >
                        {advancing === o.id && <Spinner size={14} />}
                        Lanjutkan ke {STATUS_LABEL[next as StatusKey]}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Done */}
          {done.length > 0 && (
            <section aria-label="Pesanan selesai">
              <h2 className="text-sm font-semibold text-on-surface mb-2">Selesai</h2>
              <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface px-4">
                {done.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-3">
                    <p className="font-medium text-ink">
                      #{o.orderNumber} <span className="text-muted font-normal">· {o.customerName}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted">{formatRupiah(o.totalPrice)}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ToastHost />
    </div>
  );
}