import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/** PUT /api/admin/menu/[id] — full update */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ success: false, error: "Menu tidak ditemukan" }, { status: 404 });
  }
  const existing = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!existing) return NextResponse.json({ success: false, error: "Menu tidak ditemukan" }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body tidak valid" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : existing.name;
  const price = body.price !== undefined ? Number(body.price) : existing.price;
  const categoryId = body.categoryId !== undefined ? Number(body.categoryId) : existing.categoryId;
  if (!name || !categoryId || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ success: false, error: "Nama, kategori, dan harga tidak valid" }, { status: 400 });
  }

  const item = await prisma.menuItem.update({
    where: { id: itemId },
    data: {
      name,
      price,
      categoryId,
      description: body.description !== undefined ? (body.description as string)?.trim() || null : existing.description,
      imageUrl: body.imageUrl !== undefined ? (body.imageUrl as string)?.trim() || null : existing.imageUrl,
      available: body.available !== undefined ? typeof body.available === "boolean" ? body.available : existing.available : existing.available,
      // ponytail: null -> undefined so Prisma treats it as "no change"
      customizationOptions:
        typeof body.customizationOptions === "string"
          ? body.customizationOptions
          : (existing.customizationOptions ?? undefined),
    },
    include: { category: true },
  });
  return NextResponse.json({ success: true, data: item });
}

/** DELETE /api/admin/menu/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ success: false, error: "Menu tidak ditemukan" }, { status: 404 });
  }
  await prisma.menuItem.delete({ where: { id: itemId } });
  return NextResponse.json({ success: true });
}