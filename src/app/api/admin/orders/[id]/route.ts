import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { nextStatus } from "@/lib/format";
import { emitOrderStatus } from "@/lib/order-stream";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/orders/[id] — advance status forward only (Baru→…→Selesai) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) {
    return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan" }, { status: 404 });
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan" }, { status: 404 });

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body tidak valid" }, { status: 400 });
  }

  const valid = ["baru", "diproses", "siap_diambil", "selesai"];
  if (!body.status || !valid.includes(body.status)) {
    return NextResponse.json({ success: false, error: "Status tidak valid" }, { status: 400 });
  }

  // Forward-only transitions: only allow moving to the next status
  const next = nextStatus(order.status);
  if (next && body.status !== next) {
    return NextResponse.json(
      { success: false, error: `Status hanya bisa maju ke ${next}` },
      { status: 400 }
    );
  }
  // If order already final (selesai), status stays
  const finalStatus = next === null && order.status === "selesai" ? order.status : body.status;

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: finalStatus as typeof order.status },
    include: { items: true },
  });

  // Real-time push to the customer's tracking page / riwayat — token-gated per
  // order, so only the owner's open streams receive this (see /api/orders/[id]/stream).
  emitOrderStatus(updated);

  return NextResponse.json({ success: true, data: updated });
}