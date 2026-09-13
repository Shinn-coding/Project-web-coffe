"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { Spinner } from "@/components/ui/spinner";
import { formatRupiah } from "@/lib/format";
import {
  normalizeOptions,
  selectionDelta,
  defaultSelection,
  type CustomizationSelection,
} from "@/lib/customization";
import { useCart } from "@/lib/store/cart";
import type { MenuItemDto } from "@/lib/types";

export function CustomizationModal({
  item,
  open,
  onOpenChange,
}: {
  item: MenuItemDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const opts = normalizeOptions(item.customizationOptions);
  // Parent renders <CustomizationModal key={item.id}> so state resets per item
  const [sel, setSel] = useState<CustomizationSelection>(() => defaultSelection(opts));
  const [adding, setAdding] = useState(false);
  const addItem = useCart((s) => s.addItem);

  const delta = selectionDelta(opts, sel);
  const lineTotal = (item.price + delta) * sel.quantity;

  function handleAdd() {
    setAdding(true);
    // brief async tick so the button shows a spinner, then commit
    setTimeout(() => {
      addItem({
        menuItemId: item.id,
        name: item.name,
        imageUrl: item.imageUrl,
        basePrice: item.price,
        selection: sel,
        itemOptions: opts,
      });
      setAdding(false);
      onOpenChange(false);
    }, 150);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="bottom" title={`Sesuaikan ${item.name}`}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-balance">{item.name}</h2>
        <SheetClose />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {/* Canonical groups (new admin builder + legacy menus mapped via normalizeOptions) */}
        {opts.groups?.map((g) => (
          <Group key={g.id} label={g.name}>
            {g.type === "single" ? (
              <Segmented
                options={g.options.map((o) => ({
                  value: o.name,
                  label: o.name + (o.priceDelta ? ` +${formatRupiah(o.priceDelta)}` : ""),
                }))}
                value={sel.choices?.[g.id]?.[0] ?? ""}
                onChange={(v) =>
                  setSel((s) => ({ ...s, choices: { ...s.choices, [g.id]: [v] } }))
                }
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const active = (sel.choices?.[g.id] ?? []).includes(o.name);
                  return (
                    <button
                      key={o.name}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setSel((s) => {
                          const cur = s.choices?.[g.id] ?? [];
                          return {
                            ...s,
                            choices: {
                              ...s.choices,
                              [g.id]: active ? cur.filter((c) => c !== o.name) : [...cur, o.name],
                            },
                          };
                        })
                      }
                      className={cn(
                        "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors cursor-pointer",
                        active
                          ? "bg-primary/10 text-on-primary-soft border border-primary"
                          : "bg-white border border-border text-on-surface hover:bg-surface-2"
                      )}
                    >
                      {active && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />}
                      {o.name}
                      {o.priceDelta > 0 && (
                        <span className="text-muted text-xs">+{formatRupiah(o.priceDelta)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Group>
        ))}

        {/* Quantity */}
        <Group label="Jumlah">
          <Stepper
            value={sel.quantity}
            onChange={(q) => setSel((s) => ({ ...s, quantity: q }))}
          />
        </Group>
      </div>

      <div className="border-t border-border p-4 flex items-center justify-between gap-3 bg-surface">
        <div className="flex flex-col">
          <span className="text-xs text-muted uppercase tracking-wide font-medium">Total</span>
          <span className="text-base font-bold text-ink">{formatRupiah(lineTotal)}</span>
        </div>
        <Button size="lg" onClick={handleAdd} disabled={adding} className="flex-1 max-w-[240px]">
          {adding && <Spinner size={16} />}
          Tambahkan • {formatRupiah(lineTotal)}
        </Button>
      </div>
    </Sheet>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-xs font-medium uppercase tracking-wide text-muted mb-2">{label}</legend>
      {children}
    </fieldset>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors cursor-pointer",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              active
                ? "bg-primary text-primary-fg"
                : "bg-white border border-border text-on-surface hover:bg-surface-2"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}