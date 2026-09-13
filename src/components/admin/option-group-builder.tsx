"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  newGroup,
  validateGroups,
  groupsToOptions,
  optionsToGroups,
  type GroupModel,
} from "@/lib/option-groups";

/**
 * Dynamic option-group builder for the admin menu form — replaces the raw JSON
 * textarea. Admin sees named groups + options only; JSON is generated on submit.
 */
export function OptionGroupBuilder({
  value,
  onChange,
}: {
  value: GroupModel[];
  onChange: (groups: GroupModel[]) => void;
}) {
  const [validationError, setValidationError] = useState<string | null>(null);

  function update(next: GroupModel[]) {
    onChange(next);
    if (validationError) setValidationError(null);
  }

  function addGroup() {
    update([...value, newGroup()]);
  }

  function updateGroup(idx: number, patch: Partial<GroupModel>) {
    update(value.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  function removeGroup(idx: number) {
    update(value.filter((_, i) => i !== idx));
  }

  function addOption(gi: number) {
    update(value.map((g, i) => (i === gi ? { ...g, options: [...g.options, { name: "", price: "" }] } : g)));
  }

  function updateOption(gi: number, oi: number, patch: Partial<{ name: string; price: string }>) {
    update(
      value.map((g, i) =>
        i === gi ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : g
      )
    );
  }

  function removeOption(gi: number, oi: number) {
    update(value.map((g, i) => (i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g)));
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Belum ada grup opsi. Menu dapat dipesan tanpa kustomisasi.
        </p>
      ) : (
        value.map((group, gi) => (
          <div
            key={group.key}
            className="rounded-[var(--radius-md)] border border-border bg-bg p-4 flex flex-col gap-3"
          >
            {/* Group header: name + type + delete */}
            <div className="flex items-start gap-2">
              <div className="flex-1 flex flex-col gap-1.5">
                <label
                  htmlFor={`g-name-${group.key}`}
                  className="text-xs font-medium uppercase tracking-wide text-muted"
                >
                  Nama Grup
                </label>
                <Input
                  id={`g-name-${group.key}`}
                  value={group.name}
                  onChange={(e) => updateGroup(gi, { name: e.target.value })}
                  placeholder="Misal: Ukuran, Topping"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  Tipe Pilihan
                </span>
                <div className="inline-flex h-11 overflow-hidden rounded-[var(--radius-sm)] border border-border">
                  {(["single", "multiple"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateGroup(gi, { type: t })}
                      aria-pressed={group.type === t}
                      className={cn(
                        "px-3 text-sm font-medium transition-colors cursor-pointer",
                        group.type === t
                          ? "bg-primary text-primary-fg"
                          : "bg-white text-on-surface hover:bg-surface-2"
                      )}
                    >
                      {t === "single" ? "Pilih satu" : "Pilih banyak"}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted hover:text-status-error shrink-0 self-end"
                onClick={() => removeGroup(gi)}
                aria-label={`Hapus grup ${group.name || "(tanpa nama)"}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Options */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Pilihan</span>
              {group.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Input
                    value={opt.name}
                    onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                    placeholder="Nama pilihan (misal: Besar)"
                    aria-label={`Nama pilihan di grup ${group.name || "(tanpa nama)"}`}
                    className="flex-1"
                  />
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                      aria-hidden="true"
                    >
                      +
                    </span>
                    <Input
                      value={opt.price}
                      onChange={(e) => updateOption(gi, oi, { price: e.target.value.replace(/[^\d]/g, "") })}
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`Harga tambahan di grup ${group.name || "(tanpa nama)"}`}
                      className="w-32 pl-7"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                      Rp
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted hover:text-status-error shrink-0"
                    onClick={() => removeOption(gi, oi)}
                    aria-label={`Hapus pilihan ${opt.name || "(kosong)"}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>

            <div>
              <Button type="button" variant="secondary" size="sm" onClick={() => addOption(gi)}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Pilihan
              </Button>
            </div>
          </div>
        ))
      )}

      {validationError && (
        <p
          className="rounded-[var(--radius-sm)] bg-status-error/10 border border-status-error/30 px-3 py-2 text-sm text-status-error"
          role="alert"
        >
          {validationError}
        </p>
      )}

      <Button type="button" variant="secondary" onClick={addGroup} className="self-start">
        <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Grup Opsi
      </Button>
    </div>
  );
}

/** Re-exported so the menu form can validate + serialize on submit. */
export { validateGroups, groupsToOptions, optionsToGroups };
