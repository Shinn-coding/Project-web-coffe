import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/** GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD — aggregates + top products + daily revenue */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const defaultTo = new Date(today);
  defaultTo.setDate(defaultTo.getDate() + 1); // end of today

  const from = searchParams.get("from") ? new Date(searchParams.get("from") + "T00:00:00") : today;
  const to = searchParams.get("to") ? new Date(searchParams.get("to") + "T23:59:59") : defaultTo;

  const where = { createdAt: { gte: from, lte: to } };

  const [totalOrders, revenue, topProducts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ _sum: { totalPrice: true }, _avg: { totalPrice: true }, where }),
    prisma.orderItem.groupBy({
      by: ["itemName"],
      where: { order: where },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
  ]);

  // Daily revenue buckets (for a lightweight chart)
  const orders = await prisma.order.findMany({ where, select: { createdAt: true, totalPrice: true } });
  const dailyMap = new Map<string, number>();
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + o.totalPrice);
  }
  const daily = [...dailyMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, revenuePerDay]) => ({ date, revenue: revenuePerDay }));

  return NextResponse.json({
    success: true,
    data: {
      totalOrders,
      revenue: revenue._sum.totalPrice ?? 0,
      avgOrder: revenue._avg.totalPrice ?? 0,
      topProducts: topProducts.map((p) => ({
        name: p.itemName,
        quantity: p._sum.quantity ?? 0,
        revenue: p._sum.subtotal ?? 0,
      })),
      daily,
    },
  });
}