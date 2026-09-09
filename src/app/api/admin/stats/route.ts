import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** GET /api/admin/stats — dashboard numbers */
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const start = todayStart();

  const [ordersToday, revenueToday, waitingCount, topProducts, recentOrders] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: start } } }),
    prisma.order.aggregate({ _sum: { totalPrice: true }, where: { createdAt: { gte: start } } }),
    prisma.order.count({ where: { status: "baru" } }),
    prisma.orderItem.groupBy({
      by: ["itemName"],
      where: { order: { createdAt: { gte: start } } },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      ordersToday,
      revenueToday: revenueToday._sum.totalPrice ?? 0,
      waitingCount,
      topProducts: topProducts.map((p) => ({
        name: p.itemName,
        quantity: p._sum.quantity ?? 0,
        revenue: p._sum.subtotal ?? 0,
      })),
      recentOrders,
    },
  });
}