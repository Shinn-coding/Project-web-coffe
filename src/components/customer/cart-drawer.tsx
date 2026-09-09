"use client";

import { useRouter } from "next/navigation";
import { Trash2, ShoppingBag } from "lucide-react";
import { Sheet, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { formatRupiah } from "@/lib/format";
import { useCart, cartCount, cartSubtotal } from "@/lib/store/cart";

export function CartDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const removeItem = useCart((s) => s.removeItem);

  const count = cartCount(items);
  const subtotal = cartSubtotal(items);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="bottom" title="Keranjang">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">Keranjang ({count})</h2>
        <SheetClose />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <ShoppingBag className="h-10 w-10 text-muted/50" aria-hidden="true" />
          <p className="text-base font-medium text-ink">Keranjang kosong</p>
          <p className="text-sm text-muted">Belum ada yang dipesan. Yuk pilih menu dulu!</p>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
              router.push("/");
            }}
          >
            Lihat Menu
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-border">
            {items.map((item) => (
              <li key={item.key} className="py-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{item.name}</p>
                    {item.spec.length > 0 && (
                      <p className="text-xs text-muted mt-0.5 truncate">
                        {item.spec.join(" · ")}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Hapus ${item.name} dari keranjang`}
                    onClick={() => removeItem(item.key)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-status-error cursor-pointer transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <Stepper
                    value={item.quantity}
                    onChange={(q) => setQuantity(item.key, q)}
                    className="scale-90 origin-left"
                  />
                  <div className="text-right">
                    <p className="text-xs text-muted">{formatRupiah(item.unitPrice)}</p>
                    <p className="text-sm font-semibold text-ink">
                      {formatRupiah(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-border p-4 flex flex-col gap-2 bg-surface">
            <div className="flex items-center justify-between text-base">
              <span className="font-medium text-on-surface">Subtotal</span>
              <span className="font-bold text-ink">{formatRupiah(subtotal)}</span>
            </div>
            <p className="text-xs text-muted">Pembayaran dilakukan di kasir.</p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                router.push("/checkout");
              }}
            >
              Checkout
            </Button>
            <Button variant="ghost" size="md" className="w-full" onClick={() => onOpenChange(false)}>
              Lanjut Belanja
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}