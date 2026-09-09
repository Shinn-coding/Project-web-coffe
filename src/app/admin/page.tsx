"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ReceiptText, Banknote, Loader2, Trophy, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRupiah } from "@/lib/format";
import type { OrderDto } from "@/lib/types";

interface Stats {
  ordersToday: number;
  revenueToday: number;
  waitingCount: number;
  topProducts: { name: string; quantity: number }[];
  recentOrders: OrderDto[];
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal memuat");
      setStats(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Dashboard</h1>

      {error && (
        <p className="rounded-[var(--radius-sm)] bg-status-error/10 border border-status-error/30 px-3 py-2 text-sm text-status-error" role="alert">
          {error}
        </p>
      )}

      {!stats ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[var(--radius-md)]" />
          ))}
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <section aria-label="Ringkasan hari ini" className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<ReceiptText className="h-5 w-5" aria-hidden="true" />}
              label="Pesanan Hari Ini"
              value={String(stats.ordersToday)}
              tone="primary"
              href="/admin/orders"
            />
            <StatCard
              icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
              label="Pendapatan Hari Ini"
              value={formatRupiah(stats.revenueToday)}
              tone="accent"
            />
            <StatCard
              icon={<Loader2 className="h-5 w-5" aria-hidden="true" />}
              label="Menunggu Diproses"
              value={String(stats.waitingCount)}
              tone="alert"
              href="/admin/orders"
            />
            <StatCard
              icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
              label="Menu Terlaris Hari Ini"
              value={stats.topProducts[0] ? `${stats.topProducts[0].name} · ${stats.topProducts[0].quantity}x` : "—"}
              tone="neutral"
            />
          </section>

          {/* Recent orders */}
          <section aria-label="Pesanan terbaru">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-on-surface">Pesanan Terbaru</h2>
              <Link href="/admin/orders" className="inline-flex items-center gap-0.5 text-sm text-primary hover:underline">
                Lihat semua <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {stats.recentOrders.length === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                Belum ada pesanan hari ini.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface px-4">
                {stats.recentOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        #{o.orderNumber} <span className="text-muted font-normal">· {o.customerName}</span>
                      </p>
                      <p className="text-xs text-muted truncate">
                        {o.items.map((i) => `${i.itemName}×${i.quantity}`).join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-on-surface">{formatRupiah(o.totalPrice)}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "accent" | "alert" | "neutral";
  href?: string;
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    alert: "bg-status-baru/10 text-status-baru",
    neutral: "bg-surface-2 text-ink",
  } as const;
  const inner = (
    <>
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${tones[tone]}`}>
        {icon}
      </span>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
      <p className="text-lg font-bold text-ink leading-tight break-words">{value}</p>
    </>
  );
  const cls = "rounded-[var(--radius-md)] border border-border bg-surface p-3.5 block";
  return href ? (
    <Link href={href} className={`${cls} hover:border-primary transition-colors`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}