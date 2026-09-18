"use client";

import { useEffect, useRef } from "react";
import { isFinalOrderStatus } from "@/lib/format";

/**
 * Server pings every HEARTBEAT_MS (10s); two missed beats ⇒ treat the stream
 * as dead. Tuned above STALE_MS/2 so a healthy stream never trips the
 * watchdog, while a silently-buffered/dozed socket is recycled in ~24s.
 */
const STALE_MS = 24_000;
/**
 * Safety-net poll cadence (the "jaring pengaman" from the serverless hybrid
 * design): runs CONCURRENTLY with SSE — not only when the stream is down —
 * so a connection that dies silently without tripping EventSource.onerror or
 * the stale watchdog still converges within ~25s instead of hanging forever.
 */
const SAFETY_POLL_MS = 25_000;
/** Reconnect backoff schedule for the SSE stream (ms), capped at 30s. */
const BACKOFF_MS = [3_000, 6_000, 12_000, 24_000, 30_000] as const;

/**
 * Customer-side SSE hook for ONE order (privacy: the stream is token-gated
 * server-side, so it only ever carries this order's status frames).
 *
 * Hybrid robustness for serverless deploys (Vercel):
 * - SSE stays the primary transport: instant push when it works.
 * - EventSource errors + a heartbeat watchdog recycle dead streams and
 *   reconnect with a simple backoff: 3s → 6s → 12s → 24s → 30s (capped).
 * - A slow safety poll (SAFETY_POLL_MS) runs whenever the stream is down AND
 *   whenever it looks live — worst-case staleness is bounded at ~25s even if
 *   SSE dies without being detected at all.
 * - Everything (stream + poll + backoff timer) stops the moment the order
 *   reaches a FINAL status (selesai/dibatalkan) — no idle work on done orders.
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
}: {
  orderId: number | string | undefined;
  orderToken: string | undefined;
  enabled: boolean;
  onEvent: (status: string) => void;
  /** Fired on every live SSE frame (ping or status) — lets pages stop REST polling. */
  onLive?: () => void;
  /** Fired ONLY on the live→down transition (zombie socket, error, doze). */
  onDown?: () => void;
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
    let finished = false; // order reached a FINAL status — stop everything
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let staleTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
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

    const clearTimers = () => {
      if (staleTimer) {
        clearTimeout(staleTimer);
        staleTimer = null;
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const closeStream = () => {
      clearTimers();
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

    // One REST check: applies latest status; returns true when final.
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
          if (isFinalOrderStatus(status)) {
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
      pollTimer = setInterval(() => void verifyOnce(), SAFETY_POLL_MS);
    };

    let attempt = 0; // failed reconnect attempts (drives the backoff)

    // Two missed heartbeats ⇒ the socket is a zombie (open but silent).
    // markDown() fires up front so the UI hint appears while the zombie socket
    // is being recycled (its onerror would only fire on close() in some engines).
    const armStaleTimer = () => {
      if (staleTimer) clearTimeout(staleTimer);
      staleTimer = setTimeout(() => {
        if (finished || disposed || !es) return;
        markDown();
        // recycle the dead stream — reconnect via backoff, safety poll takes over
        closeStream();
        scheduleReconnect();
      }, STALE_MS);
    };

    const scheduleReconnect = () => {
      if (finished || disposed) return;
      markDown();
      startPolling();
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      attempt += 1;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (!finished && !disposed) connect();
        else stopPolling();
      }, delay);
    };

    const connect = () => {
      if (finished || disposed) return;
      es = new EventSource(`/api/orders/${orderId}/stream?token=${encodeURIComponent(orderToken)}`);

      const onFrame = () => {
        attempt = 0; // a live frame resets the backoff ladder
        armStaleTimer();
        markLive();
        // Safety poll keeps running even while live (see SAFETY_POLL_MS).
      };

      es.addEventListener("ping", (e) => {
        onFrame();
        try {
          const data = JSON.parse((e as MessageEvent).data) as { status?: string };
          // Ping carries a real status only when non-final; the DB-backed
          // heartbeat on the server would otherwise re-announce "selesai"
          // frames the client has already acted on.
          if (data.status && !isFinalOrderStatus(data.status)) onEventRef.current?.(data.status);
          // Final status on a ping means the order finished between frames —
          // converge and stop (also stops the safety poll).
          if (data.status && isFinalOrderStatus(data.status)) void verifyOnce();
        } catch {
          // malformed ping — liveness already handled
        }
      });

      es.addEventListener("status-update", (e) => {
        onFrame();
        try {
          const data = JSON.parse((e as MessageEvent).data) as { status: string };
          onEventRef.current?.(data.status);
          if (isFinalOrderStatus(data.status)) stopAll(); // final — server closes too
        } catch {
          // malformed frame — ignore, next beat will recover
        }
      });

      es.onerror = () => {
        closeStream();
        if (finished || disposed) return;
        // Stream down (reconnect backoff, doze, network switch) — the safety
        // poll keeps status fresh and the backoff ladder retries SSE.
        scheduleReconnect();
      };

      armStaleTimer();
    };

    connect();
    // initial sync in case the order changed/finished while this hook was idle
    void verifyOnce();

    // Safety poll runs from the start — SSE and poll are CONCURRENT by design
    // (jaring pengaman), so a silently-dead stream never blocks convergence.
    startPolling();

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
  }, [enabled, orderId, orderToken]);
}
