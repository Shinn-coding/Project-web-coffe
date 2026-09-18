import { isFinalOrderStatus } from "@/lib/format";

const STORAGE_KEY = "orderHistory";
const STATUS_KEY = "orderHistoryStatus";
const MAX_ENTRIES = 20;

/** Customer history entry stays for this long after the order reaches "selesai". */
const DONE_TTL_MS = 5 * 60 * 1000;

export interface OrderHistoryEntry {
  id?: number;
  orderNumber: string;
  orderToken: string;
  timestamp: string; // ISO string
}

interface StatusCache {
  [orderNumber: string]: { status: string; fetchedAt: number };
}

function readEntries(): OrderHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is OrderHistoryEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as OrderHistoryEntry).orderNumber === "string" &&
        typeof (entry as OrderHistoryEntry).orderToken === "string",
    );
  } catch {
    return [];
  }
}

function writeEntries(entries: OrderHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage penuh / private mode — riwayat gagal disimpan, abaikan
  }
}

function readStatuses(): StatusCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as StatusCache;
  } catch {
    return {};
  }
}

function writeStatuses(cache: StatusCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATUS_KEY, JSON.stringify(cache));
  } catch {
    // abaikan — cache status hanya optimasi tampilan
  }
}

export function getOrderHistory(): OrderHistoryEntry[] {
  return readEntries();
}

export function removeOrderFromHistory(orderNumber: string) {
  writeEntries(readEntries().filter((e) => e.orderNumber !== orderNumber));
}

/**
 * Auto-delete customer-side history: entry dihapus bila status "selesai" sudah
 * lebih dari DONE_TTL_MS. Status dibaca dari cache lokal yang di-update oleh
 * polling OrderEntry. HANYA menyentuh localStorage — database admin tetap utuh.
 */
export function pruneFinishedEntries(now: number = Date.now()): string[] {
  const cache = readStatuses();
  const doneAt: Record<string, number> = {};
  for (const [orderNumber, s] of Object.entries(cache)) {
    if (s && isFinalOrderStatus(s.status) && typeof s.fetchedAt === "number") {
      doneAt[orderNumber] = s.fetchedAt;
    }
  }
  const removed = readEntries()
    .filter((e) => {
      const t = doneAt[e.orderNumber];
      return t !== undefined && now - t >= DONE_TTL_MS;
    })
    .map((e) => e.orderNumber);

  if (removed.length > 0) {
    writeEntries(readEntries().filter((e) => !removed.includes(e.orderNumber)));
    for (const orderNumber of removed) delete cache[orderNumber];
    writeStatuses(cache);
  }
  return removed;
}

/** Remember latest known status per order (used by pruneFinishedEntries). */
export function cacheOrderStatus(orderNumber: string, status: string, fetchedAt: number = Date.now()) {
  const cache = readStatuses();
  cache[orderNumber] = { status, fetchedAt };
  writeStatuses(cache);
}

export function addOrderToHistory(id: number, orderNumber: string, orderToken: string) {
  const entry: OrderHistoryEntry = {
    id,
    orderNumber,
    orderToken,
    timestamp: new Date().toISOString(),
  };
  const deduped = readEntries().filter((e) => e.orderNumber !== orderNumber);
  writeEntries([entry, ...deduped].slice(0, MAX_ENTRIES));
  // Fresh order — drop any stale status row so TTL starts from a real "selesai"
  const cache = readStatuses();
  delete cache[orderNumber];
  writeStatuses(cache);
}

export function clearOrderHistory() {
  writeEntries([]);
  writeStatuses({});
}
