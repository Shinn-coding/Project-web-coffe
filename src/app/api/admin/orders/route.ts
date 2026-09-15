import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/** GET /api/admin/orders — newest first, with items. No cap: the admin inbox
 * groups by orderDate and must show the full history (a take:N here silently
 * dropped whole older-day groups once the shop passed N orders). */
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ success: true, data: orders });
}