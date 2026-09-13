// Snapshot current menu + category data from dev.db into prisma/seed-data.json
// so that `npm run db:seed` re-seeds with YOUR edited data (images, prices,
// option groups, availability) instead of the old hard-coded list.
//
// Run after any menu edit you want to keep:  npm run seed:export
// The seed stays non-destructive: it only inserts what is missing.

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

const DATA_FILE = join(process.cwd(), "prisma", "seed-data.json");

async function main() {
  const categories = await prisma.category.findMany({
    select: { name: true, description: true },
    orderBy: { id: "asc" },
  });

  const menuItems = await prisma.menuItem.findMany({
    select: {
      name: true,
      description: true,
      price: true,
      imageUrl: true,
      available: true,
      customizationOptions: true,
      category: { select: { name: true } },
    },
    orderBy: { id: "asc" },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    categories,
    menuItems: menuItems.map(({ category, ...m }) => ({ ...m, categoryName: category.name })),
  };

  writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `Exported ${payload.menuItems.length} menu items + ${categories.length} categories -> prisma/seed-data.json`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
