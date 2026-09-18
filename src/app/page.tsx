import { prisma } from "@/lib/prisma";
import { isOpenNowWIB } from "@/lib/hours";
import { MenuClient } from "@/components/customer/menu-client";

export const dynamic = "force-dynamic";

// ?meja=5 from the table QR code → prefilled into the checkout form
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ meja?: string }>;
}) {
  const { meja } = await searchParams;

  const [categories, items, settings] = await Promise.all([
    prisma.category.findMany({ orderBy: { id: "asc" } }),
    prisma.menuItem.findMany({
      include: { category: true },
      orderBy: [{ available: "desc" }, { categoryId: "asc" }],
    }),
    // Status buka/tutup dihitung di server (jam WIB) supaya overlay tutup
    // tampil di render pertama — tanpa fetch, tanpa delay di HP.
    prisma.shopSetting.findUnique({ where: { id: 1 } }),
  ]);

  const hours =
    settings?.openHour && settings?.closeHour
      ? { openHour: settings.openHour, closeHour: settings.closeHour }
      : null;

  return (
    <MenuClient
      initialItems={items.map((m) => ({ ...m, customizationOptions: String(m.customizationOptions ?? "") }))}
      categories={categories}
      tableNumber={meja ?? null}
      initialHours={hours}
      serverOpen={isOpenNowWIB(hours)}
    />
  );
}
