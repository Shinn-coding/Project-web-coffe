// One-off E2E verification (run against a dev server):
//   BASE=http://localhost:3001 tsx scripts/e2e-order-flow.ts
//
// Verifies:
//  1. Order creation works (orderDate + day-sequence orderNumber).
//  2. SSE privacy: a token-gated stream only ever receives frames for its own order.
//  3. Admin status advance pushes a real-time `status-update` SSE frame to the owner's stream.
//  4. The stream auto-closes right after the `selesai` frame (no idle connection).
//  5. A finished order refuses new SSE connections with 410.
//  6. Reports endpoint buckets by orderDate and includes per-day order counts.

import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://localhost:3001";
const prisma = new PrismaClient();

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/**
 * Fire-and-forget SSE collector. Call it WITHOUT await, keep the returned
 * handle, then PATCH statuses and finally `await handle.done`.
 * `handle.connected` resolves once the stream is registered server-side.
 */
function collectFrames(
  orderId: number,
  token: string,
  events: { event: string; data: string }[],
  deadlineMs: number,
  abortOnSelesai: boolean,
) {
  const ctl = new AbortController();
  let closedByServer = false;
  let onConnected: (ok: boolean) => void = () => {};
  const connected = new Promise<boolean>((res) => (onConnected = res));
  const done = (async () => {
    const res = await fetch(
      `${BASE}/api/orders/${orderId}/stream?token=${encodeURIComponent(token)}`,
      { signal: ctl.signal },
    );
    onConnected(res.ok && !!res.body);
    if (!res.ok || !res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          closedByServer = true; // server ended the stream
          return;
        }
        for (const frame of decoder.decode(value, { stream: true }).split("\n\n")) {
          const ev = frame.split("\n").find((l) => l.startsWith("event:"))?.slice(6).trim();
          const data = frame.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (ev && data) {
            events.push({ event: ev, data });
            if (abortOnSelesai && data.includes('"selesai"')) {
              ctl.abort(); // client gives up after the final frame
              return;
            }
          }
        }
      }
    } catch {
      // aborted — expected when abortOnSelesai
    }
  })();
  const deadline = new Promise<void>((r) => setTimeout(r, deadlineMs));
  return {
    connected,
    done: Promise.race([done, deadline]).then(() => {
      ctl.abort();
      return { closedByServer };
    }),
  };
}

async function main() {
  // ── Temp admin user (never touches the shop's real admin password) ──────
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("e2e-temp-pass", 10);
  const tempAdmin = await prisma.adminUser.upsert({
    where: { username: "e2e-temp-admin" },
    update: { passwordHash },
    create: { username: "e2e-temp-admin", passwordHash, name: "E2E Temp", role: "admin" },
  });

  try {
    await runChecks("e2e-temp-admin", "e2e-temp-pass");
  } finally {
    await prisma.adminUser.delete({ where: { id: tempAdmin.id } }).catch(() => {});
  }
}

async function runChecks(username: string, password: string) {
  // ── Login as admin (cookie jar) ──────────────────────────────────────────
  const login = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  check("admin login", login.ok);

  // ── Create two orders as two different customers ────────────────────────
  const menu = (await (await fetch(`${BASE}/api/menu`)).json()).data as { id: number }[];
  check("menu fetch", menu.length > 0, `${menu.length} items`);

  const post = (name: string) =>
    fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: name,
        items: [{ menuItemId: menu[0].id, quantity: 1, selection: {} }],
      }),
    });

  const j1 = await (await post("E2E-Customer-A")).json();
  const j2 = await (await post("E2E-Customer-B")).json();
  const A = { id: j1.order.id as number, token: j1.orderToken as string, number: j1.order.orderNumber as string };
  const B = { id: j2.order.id as number, token: j2.orderToken as string, number: j2.order.orderNumber as string };
  check("order A created", !!j1.orderToken, `#${A.number} orderDate=${j1.order.orderDate}`);
  check("order B created", !!j2.orderToken, `#${B.number}`);

  // ── 2+3. Privacy + real-time: A's stream gets A's update, never B's ─────
  const events: { event: string; data: string }[] = [];
  const s1 = collectFrames(A.id, A.token, events, 6000, true);
  // Wait until the stream is actually registered server-side (dev compilation
  // of the route can take a moment on a cold server) before advancing.
  const ok = await Promise.race([
    s1.connected,
    new Promise<boolean>((r) => setTimeout(() => r(false), 10_000)),
  ]);
  check("SSE stream connected", ok);

  const patchA = await fetch(`${BASE}/api/admin/orders/${A.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ status: "diproses" }),
  });
  check("admin advance A → diproses", patchA.ok);

  // Advance B while A's stream is open — must NOT appear on A's stream.
  const patchB = await fetch(`${BASE}/api/admin/orders/${B.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ status: "diproses" }),
  });
  check("admin advance B → diproses", patchB.ok);

  await s1.done;
  const aFrames = events.filter((e) => e.event === "status-update");
  const statuses = aFrames.map((f) => (JSON.parse(f.data) as { id: number; status: string }).status);
  const leakedB = aFrames.some((f) => (JSON.parse(f.data) as { id: number }).id === B.id);
  check("real-time status-update on owner's stream", statuses.includes("diproses"), statuses.join(","));
  check("no frames for another customer's order (privacy)", !leakedB);

  // ── 4. Drive A to selesai → server must close the stream itself ─────────
  // Connect FIRST, then advance, so no frame can race ahead of the reader.
  const events2: { event: string; data: string }[] = [];
  const s2 = collectFrames(A.id, A.token, events2, 8000, false);
  await Promise.race([
    s2.connected,
    new Promise<boolean>((r) => setTimeout(() => r(false), 10_000)),
  ]);

  for (const next of ["siap_diambil", "selesai"]) {
    await fetch(`${BASE}/api/admin/orders/${A.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ status: next }),
    });
  }

  const { closedByServer } = await s2.done;
  const seen = events2.map((f) => (JSON.parse(f.data) as { status: string }).status);
  check("selesai frame delivered", seen.includes("selesai"), seen.join(","));
  check("server auto-closed stream after final frame", closedByServer, seen.join(","));

  // ── 5. Finished order refuses new streams with 410 ──────────────────────
  const gone = await fetch(`${BASE}/api/orders/${A.id}/stream?token=${encodeURIComponent(A.token)}`);
  check("finished order SSE refused (410)", gone.status === 410, `got ${gone.status}`);

  // ── 6. Reports endpoint: orderDate buckets + order counts ───────────────
  const rep = await fetch(`${BASE}/api/admin/reports?from=2026-01-01&to=2026-12-31`, { headers: { cookie } });
  const repJson = await rep.json();
  const daily = repJson.data.daily as { date: string; revenue: number; orders: number }[];
  const todayKey = new Date().toLocaleDateString("sv-SE"); // local YYYY-MM-DD
  const todayBucket = daily.find((d) => d.date === todayKey);
  check("reports 200 + daily buckets", rep.ok && Array.isArray(daily), `${daily.length} day buckets`);
  check("today bucket includes our 2 orders", !!todayBucket && todayBucket.orders >= 2, `today=${todayBucket?.orders} orders`);

  // ── Cleanup: remove E2E test orders from the dev DB ───────────────────
  const del = await prisma.order.deleteMany({ where: { customerName: { in: ["E2E-Customer-A", "E2E-Customer-B"] } } });
  console.log(`cleanup: removed ${del.count} E2E orders`);

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
