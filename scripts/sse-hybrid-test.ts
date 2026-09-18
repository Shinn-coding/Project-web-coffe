// One-off verification of the serverless-hybrid SSE fix. Run against a prod
// server (npm run start) started with DATABASE_URL pointed at the Neon DB:
//   BASE=http://localhost:3101 npx tsx scripts/sse-hybrid-test.ts
//
// Simulates the Vercel failure mode: status changes are written DIRECTLY to
// the DB (bypassing emitOrderStatus, i.e. as if the admin PATCH ran on a
// different lambda instance) and must still reach the customer stream.
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://localhost:3101";
const prisma = new PrismaClient();

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

type Seen = { statuses: string[]; sawFinal: boolean; serverClosed: boolean };

/**
 * Open the SSE stream and collect frames for up to `deadlineMs`. `action` runs
 * once the stream is connected (so connect-time pings can't fake the result).
 */
async function collect(
  orderId: number,
  token: string,
  deadlineMs: number,
  action?: () => Promise<void>,
): Promise<Seen> {
  const seen: Seen = { statuses: [], sawFinal: false, serverClosed: false };
  const ctl = new AbortController();
  const res = await fetch(`${BASE}/api/orders/${orderId}/stream?token=${encodeURIComponent(token)}`, {
    signal: ctl.signal,
  });
  if (!res.ok || !res.body) {
    ctl.abort();
    return seen;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const loop = (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          seen.serverClosed = true;
          return;
        }
        for (const frame of decoder.decode(value, { stream: true }).split("\n\n")) {
          const ev = frame.split("\n").find((l) => l.startsWith("event:"))?.slice(6).trim();
          const data = frame.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (!data) continue;
          try {
            const status = (JSON.parse(data) as { status?: string }).status ?? "";
            if (status) seen.statuses.push(`${ev ?? "?"}:${status}`);
            // NOTE: do NOT abort on the final frame — keep reading so a server
            // close right after the frame is observed as done:true. The outer
            // deadline aborts if the server never closes.
            if (status === "selesai") seen.sawFinal = true;
          } catch {
            /* comment keepalive frame */
          }
        }
      }
    } catch {
      /* aborted */
    }
  })();
  if (action) await action();
  await Promise.race([loop, new Promise((r) => setTimeout(r, deadlineMs))]);
  ctl.abort();
  await loop.catch(() => {});
  return seen;
}

async function main() {
  // ── Real menu item for a valid order ─────────────────────────────────────
  const menu = (await (await fetch(`${BASE}/api/menu`)).json()).data as { id: number }[];
  if (menu.length === 0) throw new Error("no menu items");

  const j = await (
    await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "SSE-Hybrid-Test",
        items: [{ menuItemId: menu[0].id, quantity: 1, selection: {} }],
      }),
    })
  ).json();
  const orderId = j.order.id as number;
  const token = j.orderToken as string;
  check("test order created", !!token, `#${j.order.orderNumber}`);

  try {
    // ── 1. Cross-instance delivery: DB write (no emitOrderStatus) → ping ──
    // Stream connects first (ping "baru"), THEN the status is written straight
    // to the DB — exactly what happens on Vercel when the admin PATCH lands on
    // another lambda instance. The DB-backed heartbeat sweep must deliver the
    // new status within ~1 beat (10s) + margin.
    const seen1 = await collect(orderId, token, 16_000, async () => {
      await prisma.order.update({ where: { id: orderId }, data: { status: "diproses" } });
    });
    check(
      "cross-instance status reaches stream (DB-backed heartbeat)",
      seen1.statuses.some((s) => s.includes("diproses")),
      `frames: [${seen1.statuses.join(", ")}]`,
    );

    // ── 2. Final status written straight to DB → stream closes itself ────
    const seen2 = await collect(orderId, token, 16_000, async () => {
      await prisma.order.update({ where: { id: orderId }, data: { status: "selesai" } });
    });
    check("final status delivered to open stream", seen2.sawFinal, `frames: [${seen2.statuses.join(", ")}]`);
    check("server closed stream after final status", seen2.serverClosed);

    // ── 3. Finished order refuses new streams with 410 ───────────────────
    const gone = await fetch(`${BASE}/api/orders/${orderId}/stream?token=${encodeURIComponent(token)}`);
    check("finished order SSE refused (410)", gone.status === 410, `got ${gone.status}`);

    // ── 4. Client REST fallback: final status fetch marks order done ─────
    const rest = await (await fetch(`${BASE}/api/orders/${orderId}?token=${encodeURIComponent(token)}`)).json();
    check("REST fallback returns final status", rest?.order?.status === "selesai", String(rest?.order?.status));
  } finally {
    await prisma.order.deleteMany({ where: { customerName: "SSE-Hybrid-Test" } });
    console.log("cleanup: removed test order");
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll checks passed ✓");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
