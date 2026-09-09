import type { MenuItemDto } from "@/lib/types";

export function hasRequiredOptions(item: MenuItemDto): boolean {
  const raw = item.customizationOptions;
  let opts: any = {};
  if (typeof raw === "string") {
    try {
      opts = JSON.parse(raw || "{}");
    } catch {
      opts = {};
    }
  } else {
    opts = raw || {};
  }
  return !!(opts.sizes?.length || opts.sugarLevels?.length || opts.iceLevels?.length);
}
