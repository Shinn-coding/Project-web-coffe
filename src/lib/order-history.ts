const STORAGE_KEY = "orderHistory";
const MAX_ENTRIES = 20;

export interface OrderHistoryEntry {
  id?: number;
  orderNumber: string;
  orderToken: string;
  timestamp: string; // ISO string
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

export function getOrderHistory(): OrderHistoryEntry[] {
  return readEntries();
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
}

export function clearOrderHistory() {
  writeEntries([]);
}