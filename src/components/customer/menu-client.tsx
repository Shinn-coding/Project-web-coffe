"use client";

import * as React from "react";
import { useMemo, useState, useEffect } from "react";
import { Coffee } from "lucide-react";
import { SearchBar } from "@/components/customer/search-bar";
import { CategoryTabs } from "@/components/customer/category-tabs";
import { MenuCard } from "@/components/customer/menu-card";
import { CustomizationModal } from "@/components/customer/customization-modal";
import { CartDrawer } from "@/components/customer/cart-drawer";
import { CartBar } from "@/components/customer/cart-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useCart, cartCount } from "@/lib/store/cart";
import { hasRequiredOptions } from "@/components/customer/item-options";
import { useToasts, ToastHost } from "@/components/ui/toast";
import { isOpenAt } from "@/lib/hours";
import { ClosedOverlay, ClosedBrowseBar } from "@/components/customer/closed-overlay";
import type { CategoryDto, MenuItemDto } from "@/lib/types";

// ponytail: guarded parse so malformed customizationOptions never crash the add flow
function parseOptions(raw: string | undefined | null): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** "08:00" → "08.00" for display */
function fmt(hhmm: string): string {
  return hhmm.replace(":", ".");
}

export function MenuClient({
  initialItems,
  categories,
  tableNumber,
  initialHours,
  serverOpen,
}: {
  initialItems: MenuItemDto[];
  categories: CategoryDto[];
  tableNumber?: string | null;
  /** Jam buka dari server (SSR) — overlay bisa tampil di render pertama */
  initialHours: { openHour: string; closeHour: string } | null;
  /** Status buka/tutup dihitung server (jam WIB) saat halaman dimuat */
  serverOpen: boolean | null;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [customizing, setCustomizing] = useState<MenuItemDto | null>(null);
  // Status tutup: SSR langsung set "overlay" kalau server bilang tutup —
  // overlay ikut ter-render di HTML pertama, nol delay.
  const [closedView, setClosedView] = useState<null | "overlay" | "browse">(
    serverOpen === false ? "overlay" : null
  );
  const cartItems = useCart((s) => s.items);
  const count = cartCount(cartItems);
  const pushToast = useToasts((s) => s.push);

  const [hours, setHours] = useState(initialHours);
  // null = pakai status server (belum ada info client yang lebih baru)
  const [clientOpen, setClientOpen] = useState<boolean | null>(null);

  // QR ?meja=N → selalu adopt nomor meja dari scan: pelanggan fisik di meja itu,
  // jadi scan meja lain (pindah meja) harus mengganti nilai lama. Tanpa param → tidak diubah.
  useEffect(() => {
    if (tableNumber && useCart.getState().tableNumber !== tableNumber) {
      useCart.getState().setTableNumber(tableNumber);
    }
  }, [tableNumber]);

  // Sinkronisasi ringan: cek ulang settings sekali setelah mount (tanpa memblokir
  // status awal — yang dari server sudah tampil). Hanya update kalau berubah.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (!res.ok || !alive) return;
        const next = json.data as { openHour: string; closeHour: string } | null;
        if (!next) {
          if (initialHours) {
            setHours(null);
            setClientOpen(null);
          }
          return;
        }
        setHours((prev) => {
          const same = prev && prev.openHour === next.openHour && prev.closeHour === next.closeHour;
          return same ? prev : next;
        });
        // Selalu hitung ulang dengan jam device: menutup race di perbatasan jam buka
        // (server bilang tutup jam 21:59, device pelanggan sudah 22:00, atau sebaliknya)
        setClientOpen(isOpenAt(next, new Date()));
      } catch {
        // status server tetap dipakai
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-evaluate open/closed tiap 30s pakai jam device, agar overlay muncul otomatis
  // tepat saat jam tutup (dan hilang saat jam buka) di sesi yang sedang terbuka.
  useEffect(() => {
    const t = setInterval(() => {
      setHours((current) => {
        if (current) setClientOpen(isOpenAt(current, new Date()));
        return current;
      });
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  const isOpenNow = clientOpen ?? serverOpen;

  // Auto mode tutup/buka: jangan ganggu pilihan user, kecuali status berubah.
  useEffect(() => {
    if (isOpenNow === false && closedView === null) setClosedView("overlay");
    if (isOpenNow !== false && closedView !== null) setClosedView(null);
  }, [isOpenNow, closedView]);

  // "Cek status" di overlay: re-fetch settings tanpa reload halaman
  function recheckStatus() {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        const next = json.data as { openHour: string; closeHour: string } | null;
        setHours(next);
        setClientOpen(next ? isOpenAt(next, new Date()) : null);
      } catch {
        // diam saja — status lama tetap dipakai
      }
    })();
  }

  // Debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return initialItems.filter((i) => {
      if (category !== null && i.categoryId !== category) return false;
      if (q && !i.name.toLowerCase().includes(q) && !(i.description ?? "").toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [initialItems, category, debounced]);

  function handleAdd(item: MenuItemDto) {
    // Saat tutup: belum memilih → buka overlay; mode lihat-lihat → toast, jangan tambah
    if (isOpenNow === false) {
      if (closedView === null) setClosedView("overlay");
      else if (closedView === "browse") {
        pushToast("Pesanan belum bisa dibuat — warung masih tutup", "error");
        return;
      }
    }
    if (hasRequiredOptions(item)) {
      setCustomizing(item);
    } else {
      // No required options → add directly (default: qty 1, no extras)
      pushToast(`${item.name} ditambahkan ke keranjang`);
      // ponytail: malformed customizationOptions must not crash the add flow
      const opts = parseOptions(item.customizationOptions);
      useCart
        .getState()
        .addItem({
          menuItemId: item.id,
          name: item.name,
          imageUrl: item.imageUrl,
          basePrice: item.price,
          selection: { size: "", sugar: "", ice: "", extras: [], quantity: 1 },
          itemOptions: opts,
        });
    }
  }

  return (
    <main className="isolate mx-auto w-full max-w-[480px] flex-1 px-4 pb-32 sm:pb-28">
      {/* Sticky header */}
      <header className="sticky top-0 z-[var(--z-sticky)] -mx-4 bg-bg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-fg">
            <Coffee className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <p className="text-base font-bold text-ink">Kopi Senja</p>
            <p className="text-xs text-muted">Pesan cepat, bayar di kasir</p>
          </div>
        </div>
        <a
          href="/riwayat"
          className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-ink hover:bg-surface-2 transition-colors"
        >
          Riwayat Pesanan Saya
        </a>
        <button
          type="button"
          aria-label={`Buka keranjang, ${count} item`}
          onClick={() => setCartOpen(true)}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
            />
          </svg>
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-fg">
              {count}
            </span>
          )}
        </button>
      </header>

      {/* Search */}
      <div className="sticky top-(--header-height) z-[var(--z-sticky)] -mx-4 bg-bg px-4 pt-2 pb-2">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {/* Operating hours banner — hanya saat BUKA. Saat tutup, overlay/banner terpisah yang mengambil alih */}
      {isOpenNow === true && hours && (
        <div className="pb-2">
          <p className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
            Buka — {fmt(hours.openHour)}–{fmt(hours.closeHour)}
          </p>
        </div>
      )}

      {/* Category chips */}
      <div className="pt-1 pb-3">
        <CategoryTabs categories={categories} selected={category} onSelect={setCategory} />
      </div>

      {/* Menu grid */}
      <section aria-label="Daftar menu">
        {filtered.length === 0 ? (
          <EmptyState query={debounced} onReset={() => { setQuery(""); setCategory(null); }} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((item) => (
              <MenuCard key={item.id} item={item} onAdd={handleAdd} />
            ))}
          </div>
        )}
      </section>

      {/* Saat tutup: overlay fullscreen atau banner mode lihat-lihat */}
      {isOpenNow === false && closedView === "overlay" && hours && (
        <ClosedOverlay
          openHour={hours.openHour}
          closeHour={hours.closeHour}
          onBrowse={() => setClosedView("browse")}
          onRecheck={recheckStatus}
        />
      )}
      {isOpenNow === false && closedView === "browse" && hours && (
        <ClosedBrowseBar openHour={hours.openHour} onExit={() => setClosedView("overlay")} />
      )}
      {isOpenNow !== false && <CartBar onOpen={() => setCartOpen(true)} />}
      <CartDrawer
        open={cartOpen && isOpenNow !== false}
        onOpenChange={(open) => {
          // Saat tutup: mencoba buka keranjang → tampilkan overlay tutup
          if (open && isOpenNow === false) {
            setClosedView((v) => v ?? "overlay");
            setCartOpen(false);
            return;
          }
          setCartOpen(open);
        }}
      />

      {customizing && (
        <CustomizationModal
          key={customizing.id}
          item={customizing}
          open={!!customizing}
          onOpenChange={(open) => {
            if (!open) setCustomizing(null);
          }}
        />
      )}

      <ToastHost />
    </main>
  );
}

function EmptyState({ query, onReset }: { query: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <Coffee className="h-10 w-10 text-muted/50" aria-hidden="true" />
      <p className="text-base font-medium text-ink">
        {query ? "Menu tidak ditemukan" : "Tidak ada menu di kategori ini"}
      </p>
      <p className="text-sm text-muted">
        {query ? `Tidak ada hasil untuk “${query}”.` : "Coba lihat menu lainnya."}
      </p>
      <Button variant="secondary" onClick={onReset}>
        {query ? "Hapus pencarian" : "Lihat Semua"}
      </Button>
    </div>
  );
}

/** Skeleton grid shown during initial load (shimmer cards) */
export function MenuSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-md)] border border-border overflow-hidden">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="p-3.5 flex flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
