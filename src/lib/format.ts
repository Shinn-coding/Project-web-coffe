/** Format integer Rupiah → "Rp 25.000" */
export function formatRupiah(value: number): string {
  return "Rp " + value.toLocaleString("id-ID");
}

/** Order status display + step order for timeline */
export const STATUS_ORDER = ["baru", "diproses", "siap_diambil", "selesai"] as const;
export type StatusKey = (typeof STATUS_ORDER)[number];

export const STATUS_LABEL: Record<StatusKey, string> = {
  baru: "Baru",
  diproses: "Diproses",
  siap_diambil: "Siap Diambil",
  selesai: "Selesai",
};

/** Color dot for each status (badge always pairs dot + label) */
export const STATUS_COLOR: Record<StatusKey, string> = {
  baru: "var(--status-baru)",
  diproses: "var(--status-diproses)",
  siap_diambil: "var(--status-siap)",
  selesai: "var(--status-selesai)",
};

/**
 * Local "YYYY-MM-DD" for a Date — matches how orderDate is written by the API
 * (server-local date, NOT UTC, so day boundaries follow the coffee shop clock).
 */
export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Human label for an orderDate key: "Hari Ini", "Kemarin", or a compact
 * dd/mm/yyyy date for older days ("13/09/2026"). Deterministic from the key
 * only — no locale/Date formatting — so it is hydration-safe on server and
 * client and identical for every day older than yesterday.
 */
export function orderDateLabel(orderDate: string, today: string = localDateKey()): string {
  if (orderDate === today) return "Hari Ini";
  const [y, m, d] = today.split("-").map(Number);
  const yesterday = new Date(y, m - 1, d - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (orderDate === yesterdayKey) return "Kemarin";
  const [oy, om, od] = orderDate.split("-").map(Number);
  if (!oy || !om || !od) return orderDate; // unexpected format — show raw key
  return `${String(od).padStart(2, "0")}/${String(om).padStart(2, "0")}/${oy}`;
}

export function nextStatus(status: string): StatusKey | null {
  const i = STATUS_ORDER.indexOf(status as StatusKey);
  if (i === -1 || i >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[i + 1] as StatusKey;
}