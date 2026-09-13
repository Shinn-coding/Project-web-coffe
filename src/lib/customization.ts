// Customization options shape stored as JSON string on MenuItem.customizationOptions
//
// Two stored formats are supported:
//  - Canonical `groups` (written by the admin dynamic builder): arbitrary named
//    groups, each single- or multiple-choice, every option carries priceDelta.
//  - Legacy fixed keys (`sizes`, `sugarLevels`, `iceLevels`, `extras`) from the
//    old JSON textarea — still read everywhere via normalizeOptions().

export interface PriceOption {
  name: string;
  priceDelta: number;
}

/** Canonical option group. `id` is stable per stored group (form key + selection mapping). */
export interface OptionGroup {
  id: string;
  name: string;
  type: "single" | "multiple";
  options: PriceOption[];
}

export interface CustomizationOptions {
  sizes?: PriceOption[];
  sugarLevels?: string[];
  iceLevels?: string[];
  extras?: PriceOption[];
  groups?: OptionGroup[];
}

export interface CustomizationSelection {
  size: string;
  sugar: string;
  ice: string;
  extras: string[];
  quantity: number;
  /** Canonical groups: groupId → chosen option names (single groups hold ≤1). */
  choices?: Record<string, string[]>;
}

export function parseOptions(raw: string): CustomizationOptions {
  try {
    return JSON.parse(raw || "{}") as CustomizationOptions;
  } catch {
    return {};
  }
}

/** Fixed keys → canonical groups (id deterministic from position). */
function legacyToGroups(opts: CustomizationOptions): OptionGroup[] {
  const groups: OptionGroup[] = [];
  let n = 0;
  if (opts.sizes?.length) {
    groups.push({ id: `g-legacy-${n++}`, name: "Ukuran", type: "single", options: opts.sizes.filter(isPriceOption) });
  }
  if (opts.sugarLevels?.length) {
    groups.push({
      id: `g-legacy-${n++}`,
      name: "Tingkat Gula",
      type: "single",
      options: opts.sugarLevels.filter(isPlainName).map((name) => ({ name, priceDelta: 0 })),
    });
  }
  if (opts.iceLevels?.length) {
    groups.push({
      id: `g-legacy-${n++}`,
      name: "Tingkat Es",
      type: "single",
      options: opts.iceLevels.filter(isPlainName).map((name) => ({ name, priceDelta: 0 })),
    });
  }
  if (opts.extras?.length) {
    groups.push({ id: `g-legacy-${n++}`, name: "Tambahan", type: "multiple", options: opts.extras.filter(isPriceOption) });
  }
  return groups;
}

function isPriceOption(v: unknown): v is PriceOption {
  return typeof v === "object" && v !== null && typeof (v as PriceOption).name === "string";
}
function isPlainName(v: unknown): v is string {
  return typeof v === "string";
}

function isValidGroup(g: unknown): g is OptionGroup {
  if (typeof g !== "object" || g === null) return false;
  const o = g as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    (o.type === "single" || o.type === "multiple") &&
    Array.isArray(o.options)
  );
}

/** Parse + normalize: always returns options with canonical `groups` when any options exist. */
export function normalizeOptions(raw: string): CustomizationOptions {
  const opts = parseOptions(raw);
  if (Array.isArray(opts.groups) && opts.groups.length > 0) {
    return { groups: opts.groups.filter(isValidGroup) };
  }
  const groups = legacyToGroups(opts);
  return groups.length > 0 ? { groups } : {};
}

/** Price delta for a selection on top of base price. */
export function selectionDelta(opts: CustomizationOptions, sel: CustomizationSelection): number {
  if (opts.groups?.length) {
    let delta = 0;
    for (const g of opts.groups) {
      const chosen = sel.choices?.[g.id] ?? [];
      for (const name of chosen) {
        delta += g.options.find((o) => o.name === name)?.priceDelta ?? 0;
      }
    }
    return delta;
  }
  let delta = 0;
  const size = opts.sizes?.find((s) => s.name === sel.size);
  if (size) delta += size.priceDelta;
  for (const ex of sel.extras ?? []) {
    const extra = opts.extras?.find((e) => e.name === ex);
    if (extra) delta += extra.priceDelta;
  }
  return delta;
}

/** Human-readable spec lines for cart/receipt, e.g. ["Large (+Rp 3.000)", "Boba (+Rp 3.000)"] */
export function specLine(sel: CustomizationSelection, opts: CustomizationOptions): string[] {
  const parts: string[] = [];
  if (opts.groups?.length) {
    for (const g of opts.groups) {
      const chosen = sel.choices?.[g.id] ?? [];
      for (const o of g.options) {
        if (!chosen.includes(o.name)) continue;
        parts.push(o.priceDelta ? `${o.name} (+${formatDelta(o.priceDelta)})` : o.name);
      }
    }
    return parts;
  }
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
  if (opts.groups?.length) {
    const choices: Record<string, string[]> = {};
    for (const g of opts.groups) {
      if (g.type === "single" && g.options[0]) choices[g.id] = [g.options[0].name];
    }
    return { size: "", sugar: "", ice: "", extras: [], quantity: 1, choices };
  }
  return {
    size: opts.sizes?.[0]?.name ?? "Reguler",
    sugar: opts.sugarLevels?.[2] ?? "Normal",
    ice: opts.iceLevels?.[2] ?? "Es Normal",
    extras: [],
    quantity: 1,
  };
}

type LegacyInputKey = "size" | "sugar" | "ice" | "extras";

// ponytail: normalizeOptions() turns old fixed-key menus into canonical groups, so a
// legacy payload (size/sugar/ice/extras) must be mapped back onto those groups by
// label — labels mirror legacyToGroups()/LEGACY_GROUP_LABELS in option-groups.ts.
const LEGACY_INPUT_GROUP: Record<string, LegacyInputKey> = {
  Ukuran: "size",
  "Tingkat Gula": "sugar",
  "Tingkat Es": "ice",
  Tambahan: "extras",
};

/**
 * Build a safe selection from untrusted input (API request body): option names are
 * kept only when they exist on the menu, single groups keep at most one pick.
 */
export function sanitizeSelection(input: unknown, opts: CustomizationOptions): CustomizationSelection {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const asString = (v: unknown) => (typeof v === "string" ? v : "");
  const asStringList = (v: unknown) =>
    Array.isArray(v) ? (v as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 20) : [];

  if (opts.groups?.length) {
    const rawChoices = (typeof raw.choices === "object" && raw.choices !== null ? raw.choices : {}) as Record<string, unknown>;
    const choices: Record<string, string[]> = {};
    for (const g of opts.groups) {
      let list = Array.isArray(rawChoices[g.id]) ? (rawChoices[g.id] as unknown[]) : [];
      const legacyKey = LEGACY_INPUT_GROUP[g.name];
      if (list.length === 0 && legacyKey) {
        if (legacyKey === "extras" && g.type === "multiple") {
          list = asStringList(raw.extras);
        } else if (g.type === "single") {
          const v = asString(raw[legacyKey]);
          if (v) list = [v];
        }
      }
      const names = new Set(g.options.map((o) => o.name));
      const picked: string[] = [];
      for (const v of list) {
        if (typeof v !== "string" || !names.has(v) || picked.includes(v)) continue;
        picked.push(v);
        if (g.type === "single" || picked.length >= g.options.length) break;
      }
      if (picked.length > 0) choices[g.id] = picked;
    }
    return { size: asString(raw.size), sugar: asString(raw.sugar), ice: asString(raw.ice), extras: asStringList(raw.extras), quantity: 1, choices };
  }

  const extras = asStringList(raw.extras);
  return { size: asString(raw.size), sugar: asString(raw.sugar), ice: asString(raw.ice), extras, quantity: 1 };
}
