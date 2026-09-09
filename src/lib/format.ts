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

export function nextStatus(status: string): StatusKey | null {
  const i = STATUS_ORDER.indexOf(status as StatusKey);
  if (i === -1 || i >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[i + 1] as StatusKey;
}