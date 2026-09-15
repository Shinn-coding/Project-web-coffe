// ponytail: in-process broadcaster — swap for Redis pub/sub only if the app
// is ever deployed with more than one Node instance.
//
// IMPORTANT: this state MUST live on globalThis (same pattern as
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
 * Heartbeats: both admin and order streams receive an `event: ping` frame
 * (echoing the last status/orderNumber) every HEARTBEAT_MS. Purpose:
 *  1. Keeps intermediaries from buffering/tearing down idle streams.
 *  2. Lets clients DETECT a silently-dead connection quickly (EventSource
 *     alone stays "OPEN" on a dead socket, e.g. phone doze) — on two missed
 *     pings the client reconnects or falls back to REST polling.
 */

type NewOrderEvent = { id: string; orderNumber: string; status: string }; // orderNumber is the padded display number (e.g. "0003")
type StatusEvent = { id: number; orderNumber: string; status: string };

const encoder = new TextEncoder();

/** How often every stream gets a keepalive `ping` frame. */
export const HEARTBEAT_MS = 10_000;

type StreamState = {
  adminClients: Set<ReadableStreamDefaultController<Uint8Array>>;
  /** orderToken → controllers subscribed to that order's status updates */
  orderClients: Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>;
  /** Most recent known state per order — lets pings double as catch-up frames. */
  lastState: Map<string, { id: number; orderNumber: string; status: string }>;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
};

const globalForStream = globalThis as unknown as { __orderStreamState?: StreamState };

const state: StreamState = globalForStream.__orderStreamState ?? {
  adminClients: new Set(),
  orderClients: new Map(),
  lastState: new Map(),
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
 * Latest known state for an order (status/orderNumber), or undefined if the
 * process hasn't seen it. The stream route sends it as an immediate ping on
 * connect so clients converge instantly and every stream has a first frame
 * within HEARTBEAT_MS.
 */
export function getLastOrderState(orderToken: string) {
  return state.lastState.get(orderToken);
}

/**
 * Push a status change to every stream subscribed to THIS order's token.
 * The frame never contains the token or customer data — subscribers already
 * proved ownership of the token when they connected.
 *
 * Resource-frugal by design: once the order reaches "selesai" the status can
 * never change again, so every subscriber stream is closed right after the
 * final frame (the client closes its EventSource too). No open connection is
 * left idling on a finished order.
 */
export function emitOrderStatus(order: { id: number; orderNumber: string; orderToken: string; status: string }) {
  state.lastState.set(order.orderToken, {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
  });

  const set = state.orderClients.get(order.orderToken);
  if (!set || set.size === 0) return;

  const event: StatusEvent = { id: order.id, orderNumber: order.orderNumber, status: order.status };
  const frame = `event: status-update\ndata: ${JSON.stringify(event)}\n\n`;
  const done = order.status === "selesai";

  for (const controller of [...set]) {
    enqueue(controller, frame);
    if (done) {
      removeOrderClient(order.orderToken, controller);
      try {
        controller.close();
      } catch {
        // already closed — nothing to do
      }
    }
  }
}

// ─── Heartbeat sweep (keepalive + liveness for all streams) ─────────────

function ensureHeartbeat() {
  if (state.heartbeatTimer) return;
  const timer = setInterval(() => {
    const now = Date.now();

    // Admin streams: plain comment keepalive (their events are push-only).
    const adminFrame = `: ping ${now}\n\n`;
    for (const controller of [...state.adminClients]) enqueue(controller, adminFrame);

    // Order streams: an `event: ping` echoing the last known status, so a
    // client that missed a real update converges on the next beat.
    for (const [token, set] of [...state.orderClients]) {
      const last = state.lastState.get(token);
      const frame =
        last !== undefined
          ? `event: ping\ndata: ${JSON.stringify(last)}\n\n`
          // Interim heartbeat between order creation and the first status
          // change — token values stay private to the token holder.
          : `event: ping\ndata: {"status":"baru"}\n\n`;
      for (const controller of [...set]) enqueue(controller, frame);
    }
  }, HEARTBEAT_MS);
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
