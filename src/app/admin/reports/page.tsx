"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/format";

interface Report {
  totalOrders: number;
  revenue: number;
  avgOrder: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  daily: { date: string; revenue: number }[];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function weekAgoISO() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

export default function AdminReportsPage() {
  const [from, setFrom] = useState(weekAgoISO());
  const [to, setTo] = useState(todayISO());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports?from=${f}&to=${t}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal memuat laporan");
      setReport(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(from, to);
  }, [load, from, to]);

  const maxDaily = report ? Math.max(...report.daily.map((d) => d.revenue), 1) : 1;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-ink">Laporan</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="r-from" className="text-sm font-medium text-on-surface">Dari</label>
          <input
            id="r-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="h-11 rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-sm text-ink"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="r-to" className="text-sm font-medium text-on-surface">Sampai</label>
          <input
            id="r-to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="h-11 rounded-[var(--radius-sm)] border border-border bg-surface px-3 text-sm text-ink"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-[var(--radius-sm)] bg-status-error/10 border border-status-error/30 px-3 py-2 text-sm text-status-error" role="alert">
          {error}
        </p>
      )}

      {loading || !report ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius-md)]" />
          ))}
        </div>
      ) : (
        <>
          <section aria-label="Ringkasan" className="grid grid-cols-3 gap-3">
            <ReportCard label="Total Pesanan" value={String(report.totalOrders)} />
            <ReportCard label="Pendapatan" value={formatRupiah(report.revenue)} />
            <ReportCard label="Rata-rata / Pesanan" value={formatRupiah(report.avgOrder)} />
          </section>

          {/* Daily revenue */}
          <section aria-label="Pendapatan harian">
            <h2 className="text-sm font-semibold text-on-surface mb-2">Pendapatan Harian</h2>
            {report.daily.length === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                Tidak ada transaksi di rentang tanggal ini.
              </p>
            ) : (
              <div className="flex items-end gap-2 rounded-[var(--radius-md)] border border-border bg-surface p-4 h-40">
                {report.daily.map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1 h-full min-w-0">
                    <span className="text-[10px] text-muted truncate">{formatRupiah(d.revenue)}</span>
                    <div
                      className="w-full rounded-t-[var(--radius-sm)] bg-primary/80 hover:bg-primary transition-colors"
                      style={{ height: `${Math.max((d.revenue / maxDaily) * 100, 2)}%` }}
                      title={`${d.date}: ${formatRupiah(d.revenue)}`}
                    />
                    <span className="text-[10px] text-muted">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Top products */}
          <section aria-label="Menu terlaris">
            <h2 className="text-sm font-semibold text-on-surface mb-2">Menu Terlaris</h2>
            {report.topProducts.length === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
                Belum ada penjualan.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface px-4">
                {report.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-ink">
                        {i + 1}
                      </span>
                      <p className="font-medium text-ink truncate">{p.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-on-surface">{p.quantity}x · {formatRupiah(p.revenue)}</p>
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

function ReportCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3.5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink leading-tight break-words">{value}</p>
    </div>
  );
}