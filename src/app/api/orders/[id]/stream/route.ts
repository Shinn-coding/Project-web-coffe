import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  addOrderClientWithHeartbeat,
  removeOrderClient,
  getLastOrderState,
  HEARTBEAT_MS,
} from "@/lib/order-stream";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/[id]/stream?token=… — customer SSE for order status.
 *
 * Privacy: the stream is bound to ONE order via its unguessable orderToken
 * (same gate as GET /api/orders/[id]). Wrong/missing token → 404 before any
 * stream is opened, so a customer only ever receives frames for their own
 * order — never a global broadcast.
 *
 * Resource-friendly: the server closes the stream as soon as the order
 * reaches "selesai" (status can't change again), so no connection idles on a
 * finished order. Clients also auto-close on the same event.
 *
 * Anti-delay: an immediate `ping` is sent on connect (echoing the last known
 * status — instant catch-up for reconnections) and every HEARTBEAT_MS the
 * broadcaster sweeps all streams, so intermediaries can't silently buffer the
 * channel and clients can detect a dead socket within ~2 beats.
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
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderToken: true, status: true, orderNumber: true },
  });
  if (!order || order.orderToken !== token) {
    return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan" }, { status: 404 });
  }

  // Already finished → nothing can change; do not open a connection at all.
  if (order.status === "selesai") {
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
      const state = getLastOrderState(token);
      controller.enqueue(
        encoder.encode(
          `event: ping\ndata: ${JSON.stringify(state ?? { id: orderId, orderNumber: order.orderNumber, status: order.status })}\n\n`,
        ),
      );
      // Belt-and-suspenders per-stream keepalive (the broadcaster also sweeps).
      // Sweeping through the broadcaster already handles this; the timer here
      // only guards against that timer being lost across dev HMR reloads.
      const beat = setInterval(() => {
        try {
          const s = getLastOrderState(token);
          controller.enqueue(
            encoder.encode(
              `event: ping\ndata: ${JSON.stringify(s ?? { id: orderId, orderNumber: order.orderNumber, status: order.status })}\n\n`,
            ),
          );
        } catch {
          clearInterval(beat);
          if (controllerRef) removeOrderClient(token, controllerRef);
        }
      }, HEARTBEAT_MS);
      // Don't hold the process open for a stream nobody listens to anymore.
      if (typeof beat === "object" && "unref" in beat) (beat as unknown as { unref: () => void }).unref();
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
