import type { MenuItemDto } from "@/lib/types";

export function hasRequiredOptions(item: MenuItemDto): boolean {
  const opts = JSON.parse(item.customizationOptions || "{}");
  return !!(opts.sizes?.length || opts.sugarLevels?.length || opts.iceLevels?.length);
}