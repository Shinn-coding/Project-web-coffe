import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeOptions, sanitizeSelection, selectionDelta, specLine } from "@/lib/customization";
import { emitNewOrder } from "@/lib/order-stream";

export const dynamic = "force-dynamic";

const MAX_QTY = 9;

/** POST /api/orders — guest checkout, no auth. Computes total server-side. */
export async function POST(req: NextRequest) {
  let body: { customerName?: string; tableNumber?: string; items?: { menuItemId: number; quantity: number; selection?: unknown }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Body JSON tidak valid" }, { status: 400 });
  }

  const name = (body.customerName ?? "").trim();
  if (!name) return NextResponse.json({ success: false, error: "Nama wajib diisi" }, { status: 400 });

  const lines = (body.items ?? []).filter((i) => i && typeof i.menuItemId === "number" && i.quantity > 0);
  if (lines.length === 0) {
    return NextResponse.json({ success: false, error: "Keranjang kosong" }, { status: 400 });
  }
  if (lines.some((l) => l.quantity > MAX_QTY)) {
    return NextResponse.json({ success: false, error: "Jumlah item melebihi batas" }, { status: 400 });
  }

  try {
    const menuItemIds = lines.map((l) => l.menuItemId);
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } });
    const byId = new Map(menuItems.map((m) => [m.id, m]));

    // Build order items with server-side price computation + snapshots
    const orderItems = [];
    let total = 0;
    for (const line of lines) {
      const menu = byId.get(line.menuItemId);
      if (!menu) return NextResponse.json({ success: false, error: "Menu tidak ditemukan" }, { status: 400 });
      if (!menu.available) return NextResponse.json({ success: false, error: `"${menu.name}" sedang habis` }, { status: 400 });

      // ponytail: normalizeOptions covers legacy fixed keys + canonical groups;
      // sanitizeSelection drops unknown/illegal option names from the guest payload.
      const opts = normalizeOptions(typeof menu.customizationOptions === "string" ? menu.customizationOptions : "");
      const selection = sanitizeSelection(line.selection, opts);
      selection.quantity = line.quantity;
      const unitPrice = menu.price + selectionDelta(opts, selection);
      const subtotal = unitPrice * line.quantity;
      total += subtotal;

      // Snapshot customization as display strings for receipt
      const spec: string[] = specLine(selection, opts);

      orderItems.push({
        menuItemId: menu.id,
        quantity: line.quantity,
        itemName: menu.name,
        unitPrice,
        subtotal,
        customization: JSON.stringify(spec),
      });
    }

    // Order number: day sequence, zero-padded 4 digits (#0421).
    // Generate token, wrap create in retry-once for unique-collision race (S3).
    const orderToken = randomUUID();
    const order = await createOrderWithRetry({
    name,
    tableNumber: body.tableNumber?.trim() || null,
    total,
    orderItems,
    orderToken,
  });

  // Minimal SSE payload — no customer/order data beyond what the admin inbox needs
  emitNewOrder({ id: String(order.id), orderNumber: order.orderNumber, status: order.status });

  return NextResponse.json({ success: true, order, orderToken }, { status: 201 });
  } catch (err) {
    console.error("[orders POST]", err);
    return NextResponse.json({ success: false, error: "Gagal membuat pesanan" }, { status: 500 });
  }
}

/** Create order with day-sequence number, retry once on P2002 (unique orderNumber race). */
async function createOrderWithRetry(args: {
  name: string;
  tableNumber: string | null;
  total: number;
  orderItems: { menuItemId: number; quantity: number; itemName: string; unitPrice: number; subtotal: number; customization: string }[];
  orderToken: string;
}) {
  const attempt = async () => {
    // ponytail: count+create in one transaction; SQLite serializes writes so the
    // day-sequence count is race-safe. P2002 re-runs the whole attempt (fresh count).
return await prisma.$transaction(async (tx) => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCount = await tx.order.count({
        where: { createdAt: { gte: todayStart } },
      });
      const orderNumber = String(todayCount + 1).padStart(4, "0");
      return tx.order.create({
        data: {
          orderNumber,
          orderToken: args.orderToken,
          customerName: args.name,
          tableNumber: args.tableNumber,
          totalPrice: args.total,
          items: { create: args.orderItems },
        },
        include: { items: true },
      });
    });
  };
  try {
    return await attempt();
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return await attempt(); // retry once: recount + regenerate number
    }
    throw err;
  }
}