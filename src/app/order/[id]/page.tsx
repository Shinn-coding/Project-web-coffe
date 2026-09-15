import { prisma } from "@/lib/prisma";
import type { OrderDto } from "@/lib/types";
import TrackingClient from "./tracking-client";

export const dynamic = "force-dynamic";

/**
 * Server-rendered tracking page.
 *
 * ponytail: the receipt + current status are fetched on the SERVER so the page
 * is useful even where client scripts are blocked (e.g. preview sandboxes that
 * force `script-src 'none'`) — no eternal spinner. When JS runs, the client
 * component takes over and keeps the status fresh via token-gated SSE.
 *
 * Privacy: same token gate as GET /api/orders/[id] — wrong/missing token
 * renders the generic "not found" UI and reveals nothing.
 */
export default async function OrderTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const orderId = Number(id);

  let initialOrder: OrderDto | null = null;
  if (Number.isInteger(orderId) && token) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (order && order.orderToken === token) {
      initialOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        customerName: order.customerName,
        tableNumber: order.tableNumber,
        status: order.status,
        totalPrice: order.totalPrice,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((it) => ({
          id: it.id,
          quantity: it.quantity,
          itemName: it.itemName,
          unitPrice: it.unitPrice,
          subtotal: it.subtotal,
          customization: typeof it.customization === "string" ? it.customization : "[]",
        })),
      };
    }
  }

  return <TrackingClient initialOrder={initialOrder} orderId={orderId} token={token ?? ""} />;
}
