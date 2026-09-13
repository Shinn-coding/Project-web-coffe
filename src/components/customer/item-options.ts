import type { MenuItemDto } from "@/lib/types";
import { normalizeOptions } from "@/lib/customization";

/**
 * True when the menu has any choiceable options and must open the
 * customization modal before joining the cart. normalizeOptions() covers both
 * formats: the new admin builder (`groups`) and legacy fixed keys
 * (sizes/sugarLevels/iceLevels/extras) which it maps onto groups too.
 */
export function hasRequiredOptions(item: MenuItemDto): boolean {
  return (normalizeOptions(item.customizationOptions).groups?.length ?? 0) > 0;
}
