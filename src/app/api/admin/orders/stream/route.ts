import { NextResponse } from "next/server";
import { addAdminClientWithHeartbeat, removeAdminClient, HEARTBEAT_MS } from "@/lib/order-stream";
import { requireAdmin } from "@/lib/admin-guard";

// ponytail: in-process broadcaster. If this app ever scales horizontally,
// swap for Redis pub/sub — same emitNewOrder signature.

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const encoder = new TextEncoder();
  // keep a reference so cancel() can remove the controller from the Set
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;
      addAdminClientWithHeartbeat(controller);
      // tell reconnecting clients the backoff (in ms) before the first retry
      controller.enqueue(encoder.encode(`retry: 3000\n\n`));
      // immediate keepalive — flushes headers/buffers and starts the liveness clock
      controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      // keep the event loop alive so heartbeats fire while subscribers exist
      setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          removeAdminClient(controllerRef!);
        }
      }, HEARTBEAT_MS);
    },
    cancel() {
      if (controllerRef) {
        removeAdminClient(controllerRef);
      }
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