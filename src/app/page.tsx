import { prisma } from "@/lib/prisma";
import { MenuClient } from "@/components/customer/menu-client";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const [categories, items] = await Promise.all([
    prisma.category.findMany({ orderBy: { id: "asc" } }),
    prisma.menuItem.findMany({
      include: { category: true },
      orderBy: [{ available: "desc" }, { categoryId: "asc" }],
    }),
  ]);

  return <MenuClient initialItems={items.map((m) => ({ ...m, customizationOptions: String(m.customizationOptions ?? "") }))} categories={categories} />;
}