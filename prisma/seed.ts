// Seed script: categories, menu items, admin user
// Run: npm run db:seed
//
// Data source: prisma/seed-data.json — a snapshot of YOUR current menu
// (images, prices, option groups, availability). Refresh it any time with
// `npm run seed:export` after editing the menu in the admin UI.
//
// Non-destructive by design: categories and menu items are only CREATED when
// missing — existing rows (including admin edits) are never overwritten, and
// the admin password is only set for a fresh user. To force a menu reset from
// the snapshot, delete the items in the admin UI first (order history keeps
// item-name snapshots, so old orders stay legible).

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

const DATA_FILE = join(__dirname, "seed-data.json");

interface SeedCategory {
  name: string;
  description: string | null;
}

interface SeedMenuItem {
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
  customizationOptions: string;
  categoryName: string;
}

function loadSeedData(): { categories: SeedCategory[]; menuItems: SeedMenuItem[] } {
  const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as unknown;
  if (typeof raw !== "object" || raw === null) throw new Error("seed-data.json: invalid root");
  const data = raw as { categories?: unknown; menuItems?: unknown };
  if (!Array.isArray(data.categories) || !Array.isArray(data.menuItems)) {
    throw new Error("seed-data.json: expected { categories: [], menuItems: [] } — regenerate with `npm run seed:export`");
  }
  return data as { categories: SeedCategory[]; menuItems: SeedMenuItem[] };
}

async function main() {
  const { categories: seedCategories, menuItems: seedMenuItems } = loadSeedData();

  // ── Categories (upsert by unique name — non-destructive) ──
  const categoryId = new Map<string, number>();
  for (const c of seedCategories) {
    const row = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, description: c.description },
    });
    categoryId.set(c.name, row.id);
  }

  // ── Menu items (insert-if-missing by name — never overwrite admin edits) ──
  const existingNames = new Set(
    (await prisma.menuItem.findMany({ select: { name: true } })).map((m) => m.name),
  );
  const toCreate: (Omit<SeedMenuItem, "categoryName"> & { categoryId: number })[] = [];
  for (const m of seedMenuItems) {
    if (existingNames.has(m.name)) continue;
    const catId = categoryId.get(m.categoryName);
    if (!catId) {
      console.warn(`  ! skip "${m.name}": category "${m.categoryName}" not found`);
      continue;
    }
    toCreate.push({
      name: m.name,
      description: m.description,
      price: m.price,
      imageUrl: m.imageUrl,
      available: m.available,
      customizationOptions: m.customizationOptions,
      categoryId: catId,
    });
  }
  if (toCreate.length > 0) await prisma.menuItem.createMany({ data: toCreate });

  // ── Admin user (password only set on first creation) ──
  const adminUsername = "admin";
  const adminExists = await prisma.adminUser.findUnique({ where: { username: adminUsername } });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await prisma.adminUser.create({
      data: { username: adminUsername, passwordHash, name: "Admin", role: Role.admin },
    });
  }

  const counts = {
    categories: await prisma.category.count(),
    menuItems: await prisma.menuItem.count(),
    menuCreated: toCreate.length,
    menuSkipped: seedMenuItems.length - toCreate.length,
    adminUsers: await prisma.adminUser.count(),
    adminPasswordReset: !adminExists,
  };
  console.log("Seed selesai:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
