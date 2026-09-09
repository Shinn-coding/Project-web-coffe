// Customization options shape stored as JSON string on MenuItem.customizationOptions

export interface SizeOption {
  name: string;
  priceDelta: number;
}
export interface ExtraOption {
  name: string;
  priceDelta: number;
}

export interface CustomizationOptions {
  sizes?: SizeOption[];
  sugarLevels?: string[];
  iceLevels?: string[];
  extras?: ExtraOption[];
}

export interface CustomizationSelection {
  size: string;
  sugar: string;
  ice: string;
  extras: string[];
  quantity: number;
}

export function parseOptions(raw: string): CustomizationOptions {
  try {
    return JSON.parse(raw || "{}") as CustomizationOptions;
  } catch {
    return {};
  }
}

/** Price delta for a selection on top of base price. */
export function selectionDelta(opts: CustomizationOptions, sel: CustomizationSelection): number {
  let delta = 0;
  const size = opts.sizes?.find((s) => s.name === sel.size);
  if (size) delta += size.priceDelta;
  for (const ex of sel.extras ?? []) {
    const extra = opts.extras?.find((e) => e.name === ex);
    if (extra) delta += extra.priceDelta;
  }
  return delta;
}

/** Human-readable spec line for cart/receipt, e.g. "Large · Manis · Es Normal · +Bobas" */
export function specLine(sel: CustomizationSelection, opts: CustomizationOptions): string[] {
  const parts: string[] = [];
  const size = opts.sizes?.find((s) => s.name === sel.size);
  if (sel.size) parts.push(size ? `${size.name}${size.priceDelta ? ` (+${formatDelta(size.priceDelta)})` : ""}` : sel.size);
  if (sel.sugar) parts.push(sel.sugar);
  if (sel.ice) parts.push(sel.ice);
  for (const ex of sel.extras ?? []) {
    const extra = opts.extras?.find((e) => e.name === ex);
    parts.push(extra && extra.priceDelta ? `${ex} (+${formatDelta(extra.priceDelta)})` : ex);
  }
  return parts;
}

function formatDelta(v: number): string {
  return "Rp " + v.toLocaleString("id-ID");
}

/** Defaults pre-selected so customization is always valid (design principle: low decision cost) */
export function defaultSelection(opts: CustomizationOptions): CustomizationSelection {
  return {
    size: opts.sizes?.[0]?.name ?? "Reguler",
    sugar: opts.sugarLevels?.[2] ?? "Normal",
    ice: opts.iceLevels?.[2] ?? "Es Normal",
    extras: [],
    quantity: 1,
  };
}