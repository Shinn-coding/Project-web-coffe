"use client";

import { useEffect, useRef } from "react";

/** Server pings every HEARTBEAT_MS; two missed beats ⇒ treat the stream as dead. */
const STALE_MS = 24_000;
/** While the stream is down/dead, poll REST at this cadence (near-real-time). */
const FALLBACK_POLL_MS = 4_000;

/**
 * Customer-side SSE hook for ONE order (privacy: the stream is token-gated
 * server-side, so it only ever carries this order's status frames).
 *
 * Low-latency + battery-frugal:
 * - The server closes the stream right after the `selesai` frame (status can
 *   never change again) and refuses new streams for finished orders (410).
 * - The hook closes its EventSource as soon as it sees `selesai` and will not
 *   reconnect afterwards — no idle connection burning battery on a done order.
 * - The server pings every 10s; if NO frame (status or ping) arrives within
 *   STALE_MS the connection is considered dead and is recycled — this catches
 *   silently-buffered/dozed sockets that leave EventSource "OPEN" forever.
 * - REST polling only runs while the stream is down/dead, at FALLBACK_POLL_MS
 *   (not a fixed slow loop), so worst-case staleness stays a few seconds.
 * - On tab-visible after backgrounding, one instant REST sync closes any gap
 *   the OS doze introduced.
 *
 * `onEvent` receives every status change for this order (SSE frames, pings,
 * and fallback-poll results all flow through it). `onDown`/`onLive` bracket
 * the stream's health: `onDown` fires only on the transition from live→down
 * (not during the initial connect), `onLive` on the first frame of a (re)born
 * stream — pages use them to show a quiet "connection lost, retrying" hint.
 */
export function useOrderStatusStream({
  orderId,
  orderToken,
  enabled,
  onEvent,
  onLive,
  onDown,
  pollMs = FALLBACK_POLL_MS,
}: {
  orderId: number | string | undefined;
  orderToken: string | undefined;
  enabled: boolean;
  onEvent: (status: string) => void;
  /** Fired on every live SSE frame (ping or status) — lets pages stop REST polling. */
  onLive?: () => void;
  /** Fired ONLY on the live→down transition (zombie socket, error, doze). */
  onDown?: () => void;
  pollMs?: number;
}) {
  const onEventRef = useRef(onEvent);
  const onLiveRef = useRef(onLive);
  const onDownRef = useRef(onDown);

  useEffect(() => {
    // ponytail: keep the latest callback without re-subscribing the stream —
    // updated inside the effect, never during render (react-hooks/refs).
    onEventRef.current = onEvent;
    onLiveRef.current = onLive;
    onDownRef.current = onDown;
  }, [onEvent, onLive, onDown]);

  useEffect(() => {
    if (!enabled || !orderId || !orderToken) return;
    let disposed = false;
    let finished = false; // order reached "selesai" — stop everything
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let staleTimer: ReturnType<typeof setTimeout> | null = null;
    let verifyInFlight = false;
    let down = false; // stream currently considered dead (live→down bracket)

    const markDown = () => {
      if (down || finished || disposed) return;
      down = true;
      onDownRef.current?.();
    };

    const markLive = () => {
      if (finished || disposed) return;
      down = false;
      onLiveRef.current?.();
    };

    const closeStream = () => {
      if (staleTimer) {
        clearTimeout(staleTimer);
        staleTimer = null;
      }
      es?.close();
      es = null;
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const stopAll = () => {
      finished = true;
      closeStream();
      stopPolling();
    };

    // One REST check: applies latest status; returns true when finished.
    const verifyOnce = async (): Promise<boolean> => {
      if (verifyInFlight) return finished;
      verifyInFlight = true;
      try {
        const res = await fetch(`/api/orders/${orderId}?token=${encodeURIComponent(orderToken)}`);
        if (!res.ok) return finished;
        const json = await res.json();
        const status = json?.order?.status as string | undefined;
        if (status) {
          onEventRef.current?.(status);
          if (status === "selesai") {
            stopAll();
            return true;
          }
        }
      } catch {
        // network hiccup — the next beat/poll retries
      } finally {
        verifyInFlight = false;
      }
      return finished;
    };

    const startPolling = () => {
      if (pollTimer || finished || disposed) return;
      pollTimer = setInterval(() => void verifyOnce(), pollMs);
    };

    // Two missed heartbeats ⇒ the socket is a zombie (open but silent).
    // markDown() fires up front so the UI hint appears while the zombie socket
    // is being recycled (its onerror would only fire on close() in some engines).
    const armStaleTimer = () => {
      if (staleTimer) clearTimeout(staleTimer);
      staleTimer = setTimeout(() => {
        if (finished || disposed || !es) return;
        markDown();
        // recycle the dead stream — onerror fires, fallback poll takes over
        closeStream();
      }, STALE_MS);
    };

    const connect = () => {
      if (finished || disposed) return;
      // Only treat this attempt as "down" if we HAD a live stream before —
      // the brief initial connect window should not alarm the customer.
      if (es !== null) markDown();
      es = new EventSource(`/api/orders/${orderId}/stream?token=${encodeURIComponent(orderToken)}`);

      const onFrame = () => {
        // any frame (ping or real) proves the transport is alive
        armStaleTimer();
        stopPolling();
        markLive();
      };

      es.addEventListener("ping", (e) => {
        onFrame();
        try {
          const data = JSON.parse((e as MessageEvent).data) as { status?: string };
          if (data.status && data.status !== "selesai") onEventRef.current?.(data.status);
        } catch {
          // malformed ping — liveness already handled
        }
      });

      es.addEventListener("status-update", (e) => {
        onFrame();
        try {
          const data = JSON.parse((e as MessageEvent).data) as { status: string };
          onEventRef.current?.(data.status);
          if (data.status === "selesai") stopAll(); // final — server closes too
        } catch {
          // malformed frame — ignore, next beat will recover
        }
      });

      es.onerror = () => {
        closeStream();
        if (finished || disposed) return;
        // Stream down (reconnect backoff, doze, network switch) → fast REST
        // poll keeps status fresh until the stream is back.
        markDown();
        startPolling();
        setTimeout(() => {
          if (!finished && !disposed) connect();
          else stopPolling();
        }, 2_000);
      };

      armStaleTimer();
    };

    connect();
    // initial sync in case the order changed/finished while this hook was idle
    void verifyOnce();

    // Instant catch-up when the tab becomes visible again (phone doze gap).
    const onVisible = () => {
      if (document.visibilityState === "visible" && !finished && !disposed) void verifyOnce();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      stopAll();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, orderId, orderToken, pollMs]);
}
