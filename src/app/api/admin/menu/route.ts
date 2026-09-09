import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/** GET /api/admin/menu — all items with category (admin table) */
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const items = await prisma.menuItem.findMany({
    include: { category: true },
    orderBy: { id: "desc" },
  });
  return NextResponse.json({ success: true, data: items });
}

interface MenuBody {
  name?: string;
  categoryId?: number;
  price?: number;
  description?: string | null;
  imageUrl?: string | null;
  available?: boolean;
  customizationOptions?: string;
}

/** POST /api/admin/menu — create */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  if (guard.session.role !== "admin" && guard.session.role !== "kasir")
    return NextResponse.json({ success: false, error: "Tidak punya akses" }, { status: 403 });

  let body: MenuBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body tidak valid" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const price = Number(body.price);
  const categoryId = Number(body.categoryId);
  if (!name || !categoryId || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ success: false, error: "Nama, kategori, dan harga wajib diisi" }, { status: 400 });
  }

  const item = await prisma.menuItem.create({
    data: {
      name,
      categoryId,
      price,
      description: body.description?.trim() || null,
      imageUrl: body.imageUrl?.trim() || null,
      available: body.available ?? true,
      customizationOptions: body.customizationOptions ?? "{}",
    },
    include: { category: true },
  });
  return NextResponse.json({ success: true, data: item }, { status: 201 });
}