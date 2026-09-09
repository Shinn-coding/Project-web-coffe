"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { MenuItemImage } from "@/components/ui/menu-item-image";
import { useCart } from "@/lib/store/cart";
import type { MenuItemDto } from "@/lib/types";

export function MenuCard({
  item,
  onAdd,
}: {
  item: MenuItemDto;
  onAdd: (item: MenuItemDto) => void;
}) {
  const inCart = useCart((s) =>
    s.items.filter((i) => i.menuItemId === item.id).reduce((sum, i) => sum + i.quantity, 0)
  );

  return (
    <button
      type="button"
      onClick={() => item.available && onAdd(item)}
      disabled={!item.available}
      aria-disabled={!item.available}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[var(--radius-md)] bg-white border border-border text-left transition-all duration-150",
        "shadow-[var(--shadow-sm)]",
        item.available &&
          "hover:shadow-[var(--shadow-md)] hover:border-primary hover:-translate-y-px cursor-pointer",
        !item.available && "opacity-70 cursor-not-allowed"
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-2">
        <MenuItemImage
          src={item.imageUrl}
          alt={item.name}
          className={cn(!item.available && "grayscale opacity-50")}
        />
        {!item.available && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-ink/80 text-white px-2.5 py-1 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-white/70" aria-hidden="true" />
            Habis
          </span>
        )}
        {inCart > 0 && (
          <span className="absolute right-2 top-2 inline-flex items-center justify-center rounded-full bg-primary text-primary-fg px-2 h-6 text-xs font-semibold">
            {inCart} di keranjang
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3.5">
        <h3 className={cn("text-base font-semibold text-balance", !item.available && "text-muted")}>
          {item.name}
        </h3>
        {item.description && (
          <p className="text-sm text-muted line-clamp-2 text-pretty">{item.description}</p>
        )}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-on-surface">{formatRupiah(item.price)}</span>
          {item.available && (
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-fg group-hover:bg-primary-hover transition-colors"
            >
              <Plus className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}