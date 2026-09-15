"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import {
  CalendarRange,
  ReceiptText,
  Banknote,
  Coins,
  TrendingUp,
  Flame,
  Coffee,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/format";

interface DayBucket {
  date: string; // "YYYY-MM-DD"
  revenue: number;
  orders: number;
}

interface Report {
  from: string;
  to: string;
  totalOrders: number;
  revenue: number;
  avgOrder: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  daily: DayBucket[];
}

function isoOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const TODAY = () => isoOffset(0);

/** Short Indonesian day label: "Sen", "Sel", … + day-of-month. */
function dayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey.slice(5);
  const wd = new Date(y, m - 1, d).toLocaleDateString("id-ID", { weekday: "short" });
  return `${wd}, ${d}/${m}`;
}

export default function AdminReportsPage() {
  const [from, setFrom] = useState(isoOffset(-6));
  const [to, setTo] = useState(isoOffset(0));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(async (f: string, t: string) => {
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

  React.useEffect(() => {
    load(from, to);
  }, [load, from, to]);

  const maxDaily = report ? Math.max(...report.daily.map((d) => d.revenue), 1) : 1;
  const maxQty = report ? Math.max(...report.topProducts.map((p) => p.quantity), 1) : 1;

  // Continuum of days from..to so "Hari Ini" keeps a slot even with zero sales.
  const daySlots = useMemo<DayBucket[]>(() => {
    if (!report) return [];
    const map = new Map(report.daily.map((d) => [d.date, d]));
    const slots: DayBucket[] = [];
    const [fy, fm, fd] = report.from.split("-").map(Number);
    const [ty, tm, td] = report.to.split("-").map(Number);
    if (!fy || !ty) return report.daily;
    const end = new Date(ty, tm - 1, td);
    const start = new Date(fy, fm - 1, fd);
    // Guard: a range wider than 62 days collapses to actual data buckets.
    if ((end.getTime() - start.getTime()) / 86_400_000 > 62) return report.daily;
    for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      slots.push(map.get(key) ?? { date: key, revenue: 0, orders: 0 });
    }
    return slots;
  }, [report]);

  const bestDay = report ? report.daily.reduce((a, b) => (b.revenue > a.revenue ? b : a), report.daily[0]) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Laporan</h1>
        <p className="text-sm text-muted mt-0.5">Ringkasan penjualan per tanggal — dibaca sekilas, langsung paham.</p>
      </div>

      {/* Filter — segmented quick ranges + explicit date inputs */}
      <section aria-label="Filter tanggal" className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarRange className="h-4 w-4 text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-on-surface">Periode</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rentang cepat">
            {[
              { label: "Hari Ini", days: 0 },
              { label: "7 Hari", days: -6 },
              { label: "14 Hari", days: -13 },
              { label: "30 Hari", days: -29 },
            ].map((r) => {
              const active = from === isoOffset(r.days) && to === TODAY();
              return (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => {
                    setFrom(isoOffset(r.days));
                    setTo(TODAY());
                  }}
                  aria-pressed={active}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-primary text-primary-fg"
                      : "bg-surface-2 text-on-surface hover:bg-border/60"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="r-from" className="text-xs font-medium text-muted">Dari</label>
            <input
              id="r-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 rounded-[var(--radius-sm)] border border-border bg-bg px-3 text-sm text-ink"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="r-to" className="text-xs font-medium text-muted">Sampai</label>
            <input
              id="r-to"
              type="date"
              value={to}
              min={from}
              max={TODAY()}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-[var(--radius-sm)] border border-border bg-bg px-3 text-sm text-ink"
            />
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-[var(--radius-sm)] bg-status-error/10 border border-status-error/30 px-3 py-2 text-sm text-status-error" role="alert">
          {error}
        </p>
      )}

      {loading || !report ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius-md)]" />
          ))}
          <Skeleton className="h-56 rounded-[var(--radius-md)] sm:col-span-3" />
        </div>
      ) : (
        <>
          {/* Summary cards — same card language as the admin dashboard */}
          <section aria-label="Ringkasan periode" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ReportCard
              icon={<ReceiptText className="h-5 w-5" aria-hidden="true" />}
              tone="primary"
              label="Total Pesanan"
              value={String(report.totalOrders)}
            />
            <ReportCard
              icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
              tone="accent"
              label="Pendapatan"
              value={formatRupiah(report.revenue)}
            />
            <ReportCard
              icon={<Coins className="h-5 w-5" aria-hidden="true" />}
              tone="neutral"
              label="Rata-rata / Pesanan"
              value={formatRupiah(Math.round(report.avgOrder))}
            />
          </section>

          {/* Daily revenue chart */}
          <section aria-label="Pendapatan harian" className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-on-surface">Pendapatan per Tanggal</h2>
              </div>
              {bestDay && (
                <p className="text-xs text-muted">
                  Tertinggi: <span className="font-semibold text-on-surface">{dayLabel(bestDay.date)}</span> · {formatRupiah(bestDay.revenue)}
                </p>
              )}
            </div>
            {daySlots.length === 0 ? (
              <EmptyNote>Tidak ada transaksi di rentang tanggal ini.</EmptyNote>
            ) : (
              <>
                <div className="relative mt-3" style={{ height: "clamp(160px, 28vw, 240px)" }}>
                  {/* horizontal guides */}
                  <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="border-t border-border/60 w-full" />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2 px-0.5">
                    {daySlots.map((d) => {
                      const h = Math.max((d.revenue / maxDaily) * 100, d.revenue > 0 ? 4 : 0);
                      return (
                        <div key={d.date} className="group relative flex h-full flex-1 min-w-0 flex-col justify-end">
                          <div
                            className={`w-full rounded-t-[6px] transition-colors ${
                              d.revenue > 0
                                ? "bg-primary/85 group-hover:bg-primary"
                                : "bg-transparent"
                            }`}
                            style={{ height: `${h}%` }}
                          />
                          {/* tooltip — visible on hover/focus, always renderable */}
                          <div
                            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] bg-ink px-2 py-1 text-[11px] font-medium text-bg opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                            role="presentation"
                          >
                            {dayLabel(d.date)} · {d.orders} pesanan · {formatRupiah(d.revenue)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* x axis labels — thin on wide ranges so nothing overlaps */}
                <div className="mt-1.5 flex gap-1.5 sm:gap-2 px-0.5">
                  {daySlots.map((d, i) => (
                    <div key={d.date} className={`min-w-0 flex-1 text-center text-[10px] leading-tight text-muted`}>
                      {daySlots.length > 14 && i % 2 === 1 ? (
                        <span aria-hidden="true">·</span>
                      ) : (
                        dayLabel(d.date)
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Top products */}
          <section aria-label="Menu terlaris" className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-muted" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-on-surface">Menu Terlaris</h2>
            </div>
            {report.topProducts.length === 0 ? (
              <EmptyNote>Belum ada penjualan di periode ini.</EmptyNote>
            ) : (
              <ul className="flex flex-col gap-3">
                {report.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? "bg-primary text-primary-fg" : "bg-surface-2 text-ink"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium text-ink">
                          {p.name}
                          {i === 0 && <Coffee className="ml-1.5 inline h-3.5 w-3.5 text-primary" aria-label="terlaris" />}
                        </p>
                        <p className="shrink-0 text-xs text-muted">
                          {p.quantity}× · <span className="font-semibold text-on-surface">{formatRupiah(p.revenue)}</span>
                        </p>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                        <div
                          className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-primary/50"}`}
                          style={{ width: `${Math.max((p.quantity / maxQty) * 100, 3)}%` }}
                        />
                      </div>
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

function ReportCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "accent" | "neutral";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    neutral: "bg-surface-2 text-ink",
  } as const;
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-3.5">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${tones[tone]}`}>
        {icon}
      </span>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
      <p className="text-lg font-bold text-ink leading-tight break-words">{value}</p>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}
