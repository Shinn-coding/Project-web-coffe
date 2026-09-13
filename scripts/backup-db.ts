// Full-DB backup: prisma/dev.db -> prisma/dev.db.backup
// Uses SQLite VACUUM INTO, which produces a clean, consistent snapshot even
// if the dev server is running (no copy race with the WAL). Safe to run anytime:
//   npm run db:backup
// Restore manually by copying dev.db.backup back over dev.db (server stopped).

import { PrismaClient } from "@prisma/client";
import { rmSync } from "node:fs";
import { join } from "node:path";

const TARGET = join(process.cwd(), "prisma", "dev.db.backup");

const prisma = new PrismaClient();

async function main() {
  // VACUUM INTO refuses to overwrite an existing file — remove it first.
  rmSync(TARGET, { force: true });
  await prisma.$executeRawUnsafe(`VACUUM INTO '${TARGET.replace(/\\/g, "/")}'`);

  const check = new PrismaClient({ datasources: { db: { url: "file:./dev.db.backup" } } });
  const [menu, orders, categories] = await Promise.all([
    check.menuItem.count(),
    check.order.count(),
    check.category.count(),
  ]);
  await check.$disconnect();

  console.log(`Backup OK -> prisma/dev.db.backup`);
  console.log(`  menu: ${menu}, orders: ${orders}, categories: ${categories}`);
}

main()
  .catch((e) => {
    console.error("Backup gagal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
