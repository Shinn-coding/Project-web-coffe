"use client";

import { ShoppingBag } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { useCart, cartCount, cartSubtotal } from "@/lib/store/cart";

/** Sticky bottom bar — hidden when cart empty */
export function CartBar({ onOpen }: { onOpen: () => void }) {
  const items = useCart((s) => s.items);
  const count = cartCount(items);
  const subtotal = cartSubtotal(items);

  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] p-3 sm:p-4 sm:flex sm:justify-center pointer-events-none">
      <button
        type="button"
        onClick={onOpen}
        className="pointer-events-auto flex w-full sm:w-auto items-center justify-between gap-3 rounded-full bg-primary text-primary-fg px-5 py-3.5 shadow-lg hover:bg-primary-hover transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          Cart · {count}
        </span>
        <span className="text-base font-bold">{formatRupiah(subtotal)}</span>
      </button>
    </div>
  );
}