// ponytail: one-off audit — list all orders (id, orderNumber, createdAt) and flag duplicates,
// plus simulate the route's generate logic to prove the ongoing 500 root cause.
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, orderNumber: true, createdAt: true },
  });

  console.log(`total orders: ${orders.length}`);
  for (const o of orders) {
    console.log(`id=${o.id} orderNumber="${o.orderNumber}" createdAt=${o.createdAt.toISOString()}`);
  }

  const counts = new Map<string, number>();
  for (const o of orders) counts.set(o.orderNumber, (counts.get(o.orderNumber) ?? 0) + 1);
  const dups = [...counts.entries()].filter(([, c]) => c > 1);
  console.log(dups.length === 0 ? 'duplicate check: NO duplicate orderNumber values ✓' : `duplicate check: DUPLICATES: ${JSON.stringify(dups)}`);

  // ── Simulate EXACTLY what POST /api/orders does right now ──
  const now = new Date();
  const orderDate = localDateKey(now);
  const lastToday = await prisma.order.findFirst({
    where: { orderDate },
    orderBy: { id: 'desc' },
    select: { orderNumber: true },
  });
  const lastNumber = lastToday ? parseInt(lastToday.orderNumber, 10) || 0 : 0;
  const nextNumber = String(lastNumber + 1).padStart(4, '0');
  console.log(`\nsimulation: server-local orderDate=${orderDate} lastNumber=${lastNumber} → would generate orderNumber="${nextNumber}"`);

  const exists = await prisma.order.findUnique({
    where: { orderDate_orderNumber: { orderDate, orderNumber: nextNumber } },
  });
  if (exists) {
    console.log(`simulation: "${nextNumber}" ALREADY EXISTS (id=${exists.id}, createdAt=${exists.createdAt.toISOString()})`);
    console.log('simulation: → first attempt P2002, retry recounts the same 0 → same number → P2002 again → 500. Every checkout today fails.');
  }

  // Proof by real insert attempt (rolled back — writes nothing)
  try {
    await prisma.order.create({
      data: {
        orderNumber: nextNumber,
        orderDate,
        orderToken: 'audit-proof-token-not-stored',
        totalPrice: 0,
        items: { create: { itemName: 'audit', unitPrice: 0, subtotal: 0, quantity: 1, customization: '[]' } },
      },
    });
    console.log('simulation: insert unexpectedly succeeded (would need cleanup!)');
  } catch (err) {
    const code = err instanceof Prisma.PrismaClientKnownRequestError ? err.code : 'unknown';
    const meta = err instanceof Prisma.PrismaClientKnownRequestError ? err.meta : {};
    console.log(`simulation: real insert attempt → Prisma error code=${code} meta=${JSON.stringify(meta)}`);
  } finally {
    // make sure nothing lingers (create never committed on P2002, but be safe)
    await prisma.order.deleteMany({ where: { orderToken: 'audit-proof-token-not-stored' } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
