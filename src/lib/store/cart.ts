"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CustomizationOptions, CustomizationSelection } from "@/lib/customization";
import { parseOptions, selectionDelta, specLine } from "@/lib/customization";

export interface CartItem {
  key: string; // unique per item + customization combo
  menuItemId: number;
  name: string;
  imageUrl?: string | null;
  basePrice: number;
  unitPrice: number; // base + size delta + extras
  quantity: number;
  selection: CustomizationSelection;
  spec: string[]; // human-readable customization lines
}

interface CartState {
  items: CartItem[];
  addItem: (opts: {
    menuItemId: number;
    name: string;
    imageUrl?: string | null;
    basePrice: number;
    selection: CustomizationSelection;
    itemOptions: CustomizationOptions;
  }) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

function makeKey(menuItemId: number, sel: CustomizationSelection): string {
  return `${menuItemId}::${sel.size}|${sel.sugar}|${sel.ice}|${[...(sel.extras ?? [])].sort().join(",")}`;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: ({ menuItemId, name, imageUrl, basePrice, selection, itemOptions }) =>
        set((state) => {
          const key = makeKey(menuItemId, selection);
          const existing = state.items.find((i) => i.key === key);
          const unitPrice = basePrice + selectionDelta(itemOptions, selection);
          const spec = specLine(selection, itemOptions);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === key ? { ...i, quantity: i.quantity + selection.quantity } : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { key, menuItemId, name, imageUrl, basePrice, unitPrice, quantity: selection.quantity, selection, spec },
            ],
          };
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.key !== key)
              : state.items.map((i) => (i.key === key ? { ...i, quantity } : i)),
        })),
      removeItem: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    { name: "coffee-cart" }
  )
);

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

/** Re-export so the modal can always give items a valid option set. */
export { parseOptions };