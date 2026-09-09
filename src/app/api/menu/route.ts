import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/menu?category=1&available=true */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const available = searchParams.get("available");

  const where: { categoryId?: number; available?: boolean } = {};
  if (category) where.categoryId = Number(category);
  if (available !== null && available !== undefined && available !== "") {
    where.available = available === "true";
  }

  const items = await prisma.menuItem.findMany({
    where,
    include: { category: true },
    orderBy: [{ available: "desc" }, { id: "asc" }],
  });

  return NextResponse.json({ success: true, data: items });
}