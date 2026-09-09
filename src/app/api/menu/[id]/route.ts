import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/menu/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ success: false, error: "Menu tidak ditemukan" }, { status: 404 });
  }
  const item = await prisma.menuItem.findUnique({
    where: { id: Number(id) },
    include: { category: true },
  });
  if (!item) return NextResponse.json({ success: false, error: "Menu tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ success: true, data: item });
}