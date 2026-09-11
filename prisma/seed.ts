// Seed script: categories, menu items (with context-relevant dummy photos), admin user
// Run: npm run db:seed

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Verified Unsplash image IDs (HTTP 200 checked). Format: w=400&h=400&fit=crop
const img = (id: string) =>
  `https://images.unsplash.com/${id}?w=400&h=400&fit=crop&auto=format`;

// Standard drink customization options (JSON string)
const drinkOptions = JSON.stringify({
  sizes: [
    { name: "Reguler", priceDelta: 0 },
    { name: "Large", priceDelta: 3000 },
  ],
  sugarLevels: ["Tanpa Gula", "Sedikit", "Normal", "Manis"],
  iceLevels: ["Tanpa Es", "Es Sedikit", "Es Normal", "Es Banyak"],
  extras: [
    { name: "Extra Shot", priceDelta: 5000 },
    { name: "Whipped Cream", priceDelta: 4000 },
  ],
});

const pastryOptions = JSON.stringify({
  extras: [
    { name: "Mentega Ekstra", priceDelta: 2000 },
    { name: "Selai", priceDelta: 3000 },
  ],
});

async function main() {
  // ── Categories ──
  const coffee = await prisma.category.upsert({
    where: { name: "Kopi" },
    update: {},
    create: { name: "Kopi", description: "Espresso-based & manual brew" },
  });
  const nonCoffee = await prisma.category.upsert({
    where: { name: "Non-Kopi" },
    update: {},
    create: { name: "Non-Kopi", description: "Matcha, cokelat, dan lainnya" },
  });
  const pastry = await prisma.category.upsert({
    where: { name: "Pastry & Snack" },
    update: {},
    create: { name: "Pastry & Snack", description: "Roti, kue, dan camilan" },
  });

  await prisma.menuItem.deleteMany();
  await prisma.menuItem.createMany({
    data: [
      // ── Kopi ──
      { name: "Espresso", description: "Shot kopi pekat, robusta & arabica blend.", price: 15000, imageUrl: img("photo-1510591509098-f4fdc6d0ff04"), available: true, customizationOptions: drinkOptions, categoryId: coffee.id },
      { name: "Americano", description: "Espresso + air panas, ringan dan bersih.", price: 18000, imageUrl: img("photo-1514432324607-a09d9b4aefdd"), available: true, customizationOptions: drinkOptions, categoryId: coffee.id },
      { name: "Cappuccino", description: "Espresso dengan busa susu lembut.", price: 22000, imageUrl: img("photo-1572442388796-11668a67e53d"), available: true, customizationOptions: drinkOptions, categoryId: coffee.id },
      { name: "Caffe Latte", description: "Espresso + susu steamed, creamy.", price: 24000, imageUrl: img("photo-1541167760496-1628856ab772"), available: true, customizationOptions: drinkOptions, categoryId: coffee.id },
      { name: "Caramel Macchiato", description: "Latte dengan saus karamel manis.", price: 27000, imageUrl: img("photo-1572442388796-11668a67e53d"), available: true, customizationOptions: drinkOptions, categoryId: coffee.id },
      { name: "Cold Brew", description: "Seduhan dingin 12 jam, smooth & pekat.", price: 25000, imageUrl: img("photo-1517701550927-30cf4ba1dba5"), available: true, customizationOptions: drinkOptions, categoryId: coffee.id },
      // ── Non-Kopi ──
      { name: "Matcha Latte", description: "Matcha grade-A dengan susu segar.", price: 26000, imageUrl: img("photo-1515823064-d6e0c04616a7"), available: true, customizationOptions: drinkOptions, categoryId: nonCoffee.id },
      { name: "Cokelat Panas", description: "Hot chocolate kental, topping marshmallow.", price: 22000, imageUrl: img("photo-1542990253-0d0f5be5f0ed"), available: true, customizationOptions: drinkOptions, categoryId: nonCoffee.id },
      { name: "Thai Tea", description: "Teh thailand manis dengan susu.", price: 20000, imageUrl: img("photo-1561336313-0bd5e0b27ec8"), available: true, customizationOptions: drinkOptions, categoryId: nonCoffee.id },
      { name: "Lemon Tea", description: "Teh hitam segar dengan perasan lemon.", price: 16000, imageUrl: img("photo-1556679343-c7306c1976bc"), available: true, customizationOptions: drinkOptions, categoryId: nonCoffee.id },
      { name: "Red Velvet", description: "Minuman red velvet creamy, manis.", price: 24000, imageUrl: img("photo-1624353365286-3f8d62daad51"), available: true, customizationOptions: drinkOptions, categoryId: nonCoffee.id },
      // ── Pastry & Snack ──
      { name: "Croissant", description: "Croissant mentega, renyah berlapis.", price: 18000, imageUrl: img("photo-1555507036-ab1f4038808a"), available: true, customizationOptions: pastryOptions, categoryId: pastry.id },
      { name: "Banana Bread", description: "Roti pisang lembut, iris tebal.", price: 16000, imageUrl: img("photo-1595475207225-428b62bda831"), available: true, customizationOptions: pastryOptions, categoryId: pastry.id },
      { name: "Cheesecake", description: "Cheesecake krim lembut, base graham.", price: 23000, imageUrl: img("photo-1524351199678-941a58a3df50"), available: true, customizationOptions: pastryOptions, categoryId: pastry.id },
      { name: "Cinnamon Roll", description: "Roti gulung kayu manis, glaze gula.", price: 20000, imageUrl: img("photo-1509365465985-25d11c17e812"), available: true, customizationOptions: pastryOptions, categoryId: pastry.id },
      { name: "Matcha Croissant", description: "Croissant isi krim matcha. (Habis hari ini)", price: 22000, imageUrl: img("photo-1515823064-d6e0c04616a7"), available: false, customizationOptions: pastryOptions, categoryId: pastry.id },
    ],
  });

  // ── Admin user ──
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.adminUser.upsert({
    where: { username: "admin" },
    update: { name: "Admin", role: Role.admin, passwordHash },
    create: { username: "admin", passwordHash, name: "Admin", role: Role.admin },
  });

  const counts = {
    categories: await prisma.category.count(),
    menuItems: await prisma.menuItem.count(),
    adminUsers: await prisma.adminUser.count(),
  };
  console.log("Seed selesai:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());