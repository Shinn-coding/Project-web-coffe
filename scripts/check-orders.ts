// ponytail: quick DB state check for E2E verification
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [orders, menuItems, categories, adminUsers] = await Promise.all([
    prisma.order.findMany({
      orderBy: { id: 'asc' },
      include: { items: true },
    }),
    prisma.menuItem.count(),
    prisma.category.count(),
    prisma.adminUser.count(),
  ]);

  console.log(`counts: orders=${orders.length} menuItems=${menuItems} categories=${categories} adminUsers=${adminUsers}`);

  for (const o of orders) {
    console.log(
      `id=${o.id} number=${o.orderNumber} token=${o.orderToken} status=${o.status} customer=${o.customerName} table=${o.tableNumber} total=${o.totalPrice} items=${o.items.length}`
    );
    for (const i of o.items) {
      console.log(`  item: ${i.itemName} qty=${i.quantity} price=${i.unitPrice} menuItemId=${i.menuItemId ?? "null"}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());