// ponytail: in-process broadcaster. On serverless (Vercel) the admin PATCH
// and the customer's SSE stream often execute on DIFFERENT lambda instances,
// so in-memory emission alone cannot deliver cross-instance — that was the
// production bug. The heartbeat sweep therefore re-reads every subscribed
// order's status from the DB (the source of truth) each beat: single-instance
// deploys still get instant push via emitOrderStatus, while multi-instance
// deploys converge within one HEARTBEAT_MS beat, and clients keep an
// independent REST safety poll on top (use-order-status-stream.ts).
// Swap for Redis pub/sub only if sub-beat latency is ever required.
//
// IMPORTANT: the registries MUST live on globalThis (same pattern as
// src/lib/prisma.ts). Next.js can evaluate this module more than once per
// process (dev HMR recompiles, per-route bundle evaluation), so plain
// module-level registries silently SPLIT: the stream route registers a
// customer's controller in one copy of the module while the admin PATCH
// route emits into another, empty copy — PATCHes return 200, heartbeats
// keep flowing, but `status-update` frames never reach anyone. Anchoring
// the registries on globalThis guarantees one shared instance per process.

/**
 * Two strictly separated audiences:
 *
 * - ADMIN: one global set of controllers (session-gated `/api/admin/orders/stream`)
 *   receiving `new-order` events for the inbox.
 * - CUSTOMER: controllers registered PER orderToken. A stream only ever
 *   receives frames for the exact order whose token it presented, so one
 *   customer can never "nguping" another customer's order updates (privacy S1).
 *
 * Heartbeats: both admin and order streams receive a keepalive frame every
 * HEARTBEAT_MS. Purpose:
 *  1. Keeps intermediaries from buffering/tearing down idle streams.
 *  2. Lets clients DETECT a silently-dead connection quickly (EventSource
 *     alone stays "OPEN" on a dead socket, e.g. phone doze).
 *  3. For order streams the ping echoes the status freshly read from the DB,
 *     so a client that missed a real update (cross-instance emission, network
 *     blip) converges on the next beat — and a stream whose order reached a
 *     final status is closed right after the frame.
 */

type NewOrderEvent = { id: string; orderNumber: string; status: string }; // orderNumber is the padded display number (e.g. "0003")
type StatusEvent = { id: number; orderNumber: string; status: string };

import { prisma } from "@/lib/prisma";
import { isFinalOrderStatus } from "@/lib/format";

const encoder = new TextEncoder();

/** How often every stream gets a keepalive `ping` frame. */
export const HEARTBEAT_MS = 10_000;

type StreamState = {
  adminClients: Set<ReadableStreamDefaultController<Uint8Array>>;
  /** orderToken → controllers subscribed to that order's status updates */
  orderClients: Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
};

const globalForStream = globalThis as unknown as { __orderStreamState?: StreamState };

const state: StreamState = globalForStream.__orderStreamState ?? {
  adminClients: new Set(),
  orderClients: new Map(),
  heartbeatTimer: null,
};
globalForStream.__orderStreamState = state;

function enqueue(controller: ReadableStreamDefaultController<Uint8Array>, frame: string) {
  try {
    controller.enqueue(encoder.encode(frame));
  } catch {
    // controller already closed on the other side — drop it from every registry
    state.adminClients.delete(controller);
    for (const set of state.orderClients.values()) set.delete(controller);
  }
}

function closeController(controller: ReadableStreamDefaultController<Uint8Array>) {
  try {
    controller.close();
  } catch {
    // already closed — nothing to do
  }
}

// ─── Admin (global inbox) ────────────────────────────────────────────────

export function addAdminClient(controller: ReadableStreamDefaultController<Uint8Array>) {
  state.adminClients.add(controller);
}

export function removeAdminClient(controller: ReadableStreamDefaultController<Uint8Array>) {
  state.adminClients.delete(controller);
}

export function emitNewOrder(data: NewOrderEvent) {
  const frame = `event: new-order\ndata: ${JSON.stringify(data)}\n\n`;
  for (const controller of [...state.adminClients]) {
    enqueue(controller, frame);
  }
}

// ─── Customer (per-order, token-gated) ──────────────────────────────────

export function addOrderClient(orderToken: string, controller: ReadableStreamDefaultController<Uint8Array>) {
  let set = state.orderClients.get(orderToken);
  if (!set) {
    set = new Set();
    state.orderClients.set(orderToken, set);
  }
  set.add(controller);
}

export function removeOrderClient(orderToken: string, controller: ReadableStreamDefaultController<Uint8Array>) {
  const set = state.orderClients.get(orderToken);
  if (!set) return;
  set.delete(controller);
  if (set.size === 0) state.orderClients.delete(orderToken);
}

/**
 * Push a status change to every stream subscribed to THIS order's token.
 * The frame never contains the token or customer data — subscribers already
 * proved ownership of the token when they connected.
 *
 * NOTE (serverless): this only reaches controllers held by THIS instance.
 * Cross-instance delivery is handled by the DB-backed heartbeat sweep below,
 * which is why clients also run an independent REST safety poll.
 *
 * Resource-frugal by design: once the order reaches a final status nothing
 * can change anymore, so every subscriber stream is closed right after the
 * final frame (the client closes its EventSource too). No open connection is
 * left idling on a finished order.
 */
export function emitOrderStatus(order: { id: number; orderNumber: string; orderToken: string; status: string }) {
  const set = state.orderClients.get(order.orderToken);
  if (!set || set.size === 0) return;

  const event: StatusEvent = { id: order.id, orderNumber: order.orderNumber, status: order.status };
  const frame = `event: status-update\ndata: ${JSON.stringify(event)}\n\n`;
  const done = isFinalOrderStatus(order.status);

  for (const controller of [...set]) {
    enqueue(controller, frame);
    if (done) {
      removeOrderClient(order.orderToken, controller);
      closeController(controller);
    }
  }
}

// ─── Heartbeat sweep (keepalive + liveness + cross-instance delivery) ───

function ensureHeartbeat() {
  if (state.heartbeatTimer) return;
  const timer = setInterval(
    () => {
      // Admin streams: plain comment keepalive (their events are push-only).
      const adminFrame = `: ping ${Date.now()}\n\n`;
      for (const controller of [...state.adminClients]) enqueue(controller, adminFrame);

      const tokens = [...state.orderClients.keys()];
      if (tokens.length === 0) return;

      // Customer streams: echo each order's status freshly read from the DB.
      // This is what makes SSE work on serverless/multi-instance deploys:
      // a PATCH that landed on another instance still reaches every
      // subscriber here within one beat, because the DB is the shared truth.
      void prisma.order
        .findMany({
          where: { orderToken: { in: tokens } },
          select: { id: true, orderNumber: true, orderToken: true, status: true },
        })
        .then((orders) => {
          if (orders.length === 0) return;
          const byToken = new Map(orders.map((o) => [o.orderToken, o]));
          for (const [token, set] of [...state.orderClients]) {
            const order = byToken.get(token);
            if (!order) continue; // vanished mid-sweep — next beat cleans up
            const frame = `event: ping\ndata: ${JSON.stringify({
              id: order.id,
              orderNumber: order.orderNumber,
              status: order.status,
            })}\n\n`;
            const final = isFinalOrderStatus(order.status);
            for (const controller of [...set]) {
              enqueue(controller, frame);
              if (final) {
                // Status can't change anymore — close the stream so no idle
                // connection lingers on a finished order.
                removeOrderClient(token, controller);
                closeController(controller);
              }
            }
          }
        })
        .catch(() => {
          // DB blip — skip this beat; clients' safety poll covers the gap
        });
    },
    HEARTBEAT_MS,
  );
  // Don't hold the process open just for heartbeats.
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as unknown as { unref: () => void }).unref();
  }
  state.heartbeatTimer = timer;
}

// Start the sweep lazily the first time any stream subscribes.
export function addAdminClientWithHeartbeat(controller: ReadableStreamDefaultController<Uint8Array>) {
  ensureHeartbeat();
  addAdminClient(controller);
}
export function addOrderClientWithHeartbeat(token: string, controller: ReadableStreamDefaultController<Uint8Array>) {
  ensureHeartbeat();
  addOrderClient(token, controller);
}
