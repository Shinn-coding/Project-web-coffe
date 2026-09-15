import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { localDateKey } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD — aggregates + top
 * products + daily breakdown.
 *
 * ponytail: filtering/bucketing uses the `orderDate` key ("YYYY-MM-DD",
 * shop-local) instead of createdAt timestamps — the old UTC
 * `toISOString().slice(0,10)` buckets pushed early-morning orders (before
 * 07:00 in UTC+7) into the previous day. orderDate matches exactly what the
 * order-number sequence and the admin Pesanan page use.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("from") ?? "")
    ? (searchParams.get("from") as string)
    : localDateKey();
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("to") ?? "")
    ? (searchParams.get("to") as string)
    : from;

  // Lexicographic range works because both keys are zero-padded ISO dates.
  const where = { orderDate: { gte: from, lte: to } };

  const [totalOrders, revenueAgg, topProducts, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ _sum: { totalPrice: true }, _avg: { totalPrice: true }, where }),
    prisma.orderItem.groupBy({
      by: ["itemName"],
      where: { order: where },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    // Light fetch for daily buckets — id/orderDate/totalPrice only.
    prisma.order.findMany({ where, select: { orderDate: true, totalPrice: true, status: true } }),
  ]);

  const dailyMap = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    const day = dailyMap.get(o.orderDate) ?? { revenue: 0, orders: 0 };
    day.revenue += o.totalPrice;
    day.orders += 1;
    dailyMap.set(o.orderDate, day);
  }
  const daily = [...dailyMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, d]) => ({ date, revenue: d.revenue, orders: d.orders }));

  return NextResponse.json({
    success: true,
    data: {
      from,
      to,
      totalOrders,
      revenue: revenueAgg._sum.totalPrice ?? 0,
      avgOrder: revenueAgg._avg.totalPrice ?? 0,
      topProducts: topProducts.map((p) => ({
        name: p.itemName,
        quantity: p._sum.quantity ?? 0,
        revenue: p._sum.subtotal ?? 0,
      })),
      daily,
    },
  });
}
