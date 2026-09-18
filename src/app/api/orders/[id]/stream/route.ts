import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addOrderClientWithHeartbeat, removeOrderClient } from "@/lib/order-stream";
import { isFinalOrderStatus } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/[id]/stream?token=… — customer SSE for order status.
 *
 * Privacy: the stream is bound to ONE order via its unguessable orderToken
 * (same gate as GET /api/orders/[id]). Wrong/missing token → 404 before any
 * stream is opened, so a customer only ever receives frames for their own
 * order — never a global broadcast.
 *
 * Resource-friendly: the stream closes as soon as the order reaches a final
 * status (selesai/dibatalkan — nothing can change), so no connection idles on
 * a finished order. Final-status orders are refused outright with 410, and
 * clients also auto-close on the same frame.
 *
 * Anti-delay on serverless: an immediate `ping` (with the latest DB status)
 * is sent on connect — instant catch-up for reconnections — and the shared
 * heartbeat sweep re-reads every subscribed order from the DB every
 * HEARTBEAT_MS, so a status change that happened on another lambda instance
 * (Vercel) still reaches every subscriber within one beat. Clients keep an
 * independent REST safety poll on top of all this.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) {
    return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan" }, { status: 404 });
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan" }, { status: 404 });
  }

  // Token gate BEFORE opening the stream — same contract as the REST endpoint.
  // The status read here is also the freshest possible connect-time snapshot.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderToken: true, status: true, orderNumber: true },
  });
  if (!order || order.orderToken !== token) {
    return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan" }, { status: 404 });
  }

  // Already final → nothing can change; do not open a connection at all.
  if (isFinalOrderStatus(order.status)) {
    return NextResponse.json({ success: false, error: "Pesanan sudah selesai" }, { status: 410 });
  }

  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      addOrderClientWithHeartbeat(token, controller);
      // tell reconnecting clients the backoff (in ms) before the first retry
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      // Immediate first frame: flushes any intermediary buffer and gives the
      // client an instant catch-up ping with the latest known status.
      controller.enqueue(
        encoder.encode(
          `event: ping\ndata: ${JSON.stringify({ id: orderId, orderNumber: order.orderNumber, status: order.status })}\n\n`,
        ),
      );
      // No per-stream timer here: the broadcaster's DB-backed sweep delivers
      // keepalives AND cross-instance status updates every HEARTBEAT_MS.
    },
    cancel() {
      if (controllerRef) removeOrderClient(token, controllerRef);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
