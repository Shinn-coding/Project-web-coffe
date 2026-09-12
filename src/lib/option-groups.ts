import { parseOptions, type CustomizationOptions } from "./customization";

/** Fixed option-group keys shown in the menu admin form. */
export type GroupKey = "sizes" | "sugarLevels" | "iceLevels" | "extras";

export interface GroupOption {
  name: string;
  price: string;
}

export interface GroupModel {
  key: GroupKey;
  label: string;
  options: GroupOption[];
}

export const GROUP_LABELS: Record<GroupKey, string> = {
  sizes: "Ukuran",
  sugarLevels: "Tingkat Gula",
  iceLevels: "Tingkat Es",
  extras: "Tambahan",
};

/** Price input only makes sense for options that cost extra. */
export function isPaidGroup(key: GroupKey): boolean {
  return key === "sizes" || key === "extras";
}

export function emptyGroup(key: GroupKey): GroupModel {
  return { key, label: GROUP_LABELS[key], options: [{ name: "", price: "" }] };
}

const GROUP_KEYS: GroupKey[] = ["sizes", "sugarLevels", "iceLevels", "extras"];

/** Stored JSON → editable groups. Unknown/legacy keys are dropped. */
export function optionsToGroups(raw?: string): GroupModel[] {
  const opts = parseOptions(raw ?? "");
  const groups = opts.sizes
    ? [{ key: "sizes" as const, label: GROUP_LABELS.sizes, options: opts.sizes.map((o) => (typeof o === "string" ? { name: o, price: "" } : { name: o.name, price: String(o.priceDelta ?? "") })) }]
    : [];
  groups.push(
    ...GROUP_KEYS.filter((k) => k !== "sizes")
      .filter((k) => Array.isArray(opts[k]))
      .map((k) => ({ key: k, label: GROUP_LABELS[k], options: opts[k].filter(Boolean).map((name: string) => ({ name, price: "" })) })),
  );
  return groups
    .map((g) => ({ ...g, options: g.options.filter((o) => o.name.trim() !== "" && o.name.trim() !== "undefined") }))
    .filter((g) => g.options.length > 0);
}

/** Editable groups → stored JSON. */
export function groupsToOptions(groups: GroupModel[]): CustomizationOptions {
  const opts: CustomizationOptions = {};
  for (const g of groups) {
    const names = g.options.map((o) => o.name.trim()).filter(Boolean);
    if (names.length === 0) continue;
    if (isPaidGroup(g.key)) {
      opts[g.key] = g.options.map((o) => ({ name: o.name.trim(), priceDelta: Math.max(0, Number(o.price) || 0) }));
    } else {
      opts[g.key] = names;
    }
  }
  return opts;
}

// ponytail: self-check lives here, guarded so client bundles never evaluate node APIs
const isMain =
  typeof process !== "undefined" &&
  !!process.argv?.[1] &&
  decodeURIComponent(import.meta.url.replace("file://", "")) === process.argv[1];

if (isMain) {
  const expected = `{"sizes":[{"name":"Regular","priceDelta":0},{"name":"Besar","priceDelta":5000}],"sugarLevels":["Tidak","Sedang"],"extras":[{"name":"Boba","priceDelta":3000}]}`;
  const groups = optionsToGroups(expected);
  const back = JSON.stringify(groupsToOptions(groups));
  const ok = back === expected && groups.some((g) => g.key === "sizes") && groups.every((g) => g.options.length === g.options.filter((o) => o.name).length);
  // iceLevels key absent in expected → dropped; negative price clamped; empty JSON → []
  const badJson = optionsToGroups("{{{");
  const clamped = groupsToOptions([{ key: "extras", label: "Tambahan", options: [{ name: "Sagu", price: "-2" }] }]);
  const malformed = optionsToGroups('{"sizes":[{"priceDelta":3000,"name":"undefined"}],"toppings":["Cheese"]}');
  if (!ok || badJson.length !== 0 || clamped.extras![0].priceDelta !== 0 || malformed.includes('"undefined"') || malformed.includes('"":') || !malformed.includes('"Cheese"')) {
    console.error("option-groups self-check FAILED");
    process.exit(1);
  }
  console.log("option-groups self-check passed");
}