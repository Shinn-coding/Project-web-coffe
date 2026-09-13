import { normalizeOptions, type CustomizationOptions, type OptionGroup } from "./customization";

/** Legacy fixed group keys — old menus map onto these as editable presets. */
export type LegacyGroupKey = "sizes" | "sugarLevels" | "iceLevels" | "extras";

export const LEGACY_GROUP_LABELS: Record<LegacyGroupKey, string> = {
  sizes: "Ukuran",
  sugarLevels: "Tingkat Gula",
  iceLevels: "Tingkat Es",
  extras: "Tambahan",
};

const LEGACY_GROUP_TYPE: Record<LegacyGroupKey, "single" | "multiple"> = {
  sizes: "single",
  sugarLevels: "single",
  iceLevels: "single",
  extras: "multiple",
};

/** Editable form model. `key` is form-only identity (React key), never stored. */
export interface GroupModel {
  key: string;
  name: string;
  type: "single" | "multiple";
  options: GroupOption[];
}

export interface GroupOption {
  name: string;
  price: string; // raw input text; validated on submit
}

let customSeq = 0;

/** Blank group for the "+ Tambah Grup Opsi" button. */
export function newGroup(): GroupModel {
  customSeq += 1;
  return {
    key: `custom-${Date.now().toString(36)}-${customSeq}`,
    name: "",
    type: "single",
    options: [{ name: "", price: "" }],
  };
}

/** Stored JSON → editable groups. Handles both canonical groups and legacy fixed keys. */
export function optionsToGroups(raw?: string): GroupModel[] {
  const opts = normalizeOptions(raw ?? "");

  if (opts.groups?.length) {
    return opts.groups.map((g) => ({
      key: `stored-${g.id}`,
      name: g.name,
      type: g.type,
      options: g.options.map((o) => ({ name: o.name, price: String(o.priceDelta ?? 0) })),
    }));
  }

  const groups: GroupModel[] = [];
  const pairs: [LegacyGroupKey, unknown[] | undefined][] = [
    ["sizes", opts.sizes],
    ["sugarLevels", opts.sugarLevels],
    ["iceLevels", opts.iceLevels],
    ["extras", opts.extras],
  ];
  for (const [key, list] of pairs) {
    if (!list?.length) continue;
    groups.push({
      key,
      name: LEGACY_GROUP_LABELS[key],
      type: LEGACY_GROUP_TYPE[key],
      options: list.map((v) => {
        const p = asPriceOption(v);
        return p ? { name: p.name, price: String(p.priceDelta ?? 0) } : { name: String(v), price: "0" };
      }),
    });
  }
  return groups;
}

function asPriceOption(v: unknown): { name: string; priceDelta?: number } | null {
  if (typeof v === "object" && v !== null && typeof (v as { name?: unknown }).name === "string") {
    const o = v as { name: string; priceDelta?: number };
    return { name: o.name, priceDelta: o.priceDelta };
  }
  return null;
}

export interface GroupsValidation {
  ok: boolean;
  error: string | null;
}

/** Form-level validation before submit. */
export function validateGroups(groups: GroupModel[]): GroupsValidation {
  for (const g of groups) {
    const label = g.name.trim() || "(grup tanpa nama)";
    if (!g.name.trim()) return { ok: false, error: "Nama grup tidak boleh kosong" };
    const filled = g.options.filter((o) => o.name.trim() !== "");
    if (filled.length === 0) return { ok: false, error: `Grup "${label}" minimal punya 1 pilihan` };
    for (const o of g.options) {
      if (o.name.trim() === "") continue;
      const price = Number(o.price);
      if (o.price.trim() === "" || !Number.isFinite(price) || price < 0) {
        return { ok: false, error: `Harga untuk "${o.name.trim()}" pada grup "${label}" harus angka ≥ 0` };
      }
    }
    const names = filled.map((o) => o.name.trim());
    if (new Set(names).size !== names.length) {
      return { ok: false, error: `Nama pilihan duplikat di grup "${label}"` };
    }
  }
  const groupNames = groups.map((g) => g.name.trim());
  if (new Set(groupNames).size !== groupNames.length) {
    return { ok: false, error: "Nama grup tidak boleh duplikat" };
  }
  return { ok: true, error: null };
}

/** Validated editable groups → stored JSON (canonical groups shape). */
export function groupsToOptions(groups: GroupModel[]): CustomizationOptions {
  const out: OptionGroup[] = [];
  groups.forEach((g, gi) => {
    const options = g.options
      .filter((o) => o.name.trim() !== "")
      .map((o) => ({ name: o.name.trim(), priceDelta: Math.max(0, Math.round(Number(o.price) || 0)) }));
    if (options.length === 0) return;
    out.push({ id: `g-${gi}-${slug(g.name)}`, name: g.name.trim(), type: g.type, options });
  });
  return out.length > 0 ? { groups: out } : {};
}

function slug(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "grup"
  );
}

// ponytail: self-check lives here, guarded so client bundles never evaluate it
const isMain =
  typeof process !== "undefined" &&
  !!process.argv?.[1] &&
  decodeURIComponent(import.meta.url.replace("file://", "")) === process.argv[1];

if (isMain) {
  const legacy = `{"sizes":[{"name":"Regular","priceDelta":0},{"name":"Besar","priceDelta":5000}],"sugarLevels":["Tidak","Sedang"],"extras":[{"name":"Boba","priceDelta":3000}]}`;
  const g1 = optionsToGroups(legacy);
  const canonical = JSON.parse(JSON.stringify(groupsToOptions(g1))) as CustomizationOptions;
  const g2 = optionsToGroups(JSON.stringify(canonical));
  const same =
    g1.length === 3 &&
    g2.length === 3 &&
    g2[0].name === "Ukuran" &&
    g2[0].options[1].price === "5000" &&
    g2[2].name === "Tambahan" &&
    g2[2].type === "multiple";
  const custom = [newGroup()];
  custom[0].name = "Topping";
  custom[0].type = "multiple";
  custom[0].options = [
    { name: "Boba", price: "3000" },
    { name: "Cheese Foam", price: "4000" },
  ];
  const stored = groupsToOptions(custom);
  const badName = validateGroups([{ ...newGroup(), name: "  " }]).ok === false;
  const badPrice = validateGroups([{ ...custom[0], options: [{ name: "Boba", price: "-2" }] }]).ok === false;
  const dup = validateGroups([
    { ...newGroup(), name: "A", options: [{ name: "X", price: "0" }, { name: "X", price: "0" }] },
  ]).ok === false;
  const empty = JSON.stringify(groupsToOptions([])) === "{}";
  if (!same || stored.groups?.[0].options.length !== 2 || !badName || !badPrice || !dup || !empty) {
    console.error("option-groups self-check FAILED");
    process.exit(1);
  }
  console.log("option-groups self-check passed");
}
