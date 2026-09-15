// Standalone timed probe (no browser): SSE frame latency server-side.
// Usage: BASE=http://localhost:3000 npx tsx scripts/measure-sse.mts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const prisma = new PrismaClient();

const hash = bcrypt.hashSync("probe-pass", 10);
const admin = await prisma.adminUser.upsert({
  where: { username: "sse-probe-admin" },
  update: { passwordHash: hash },
  create: { username: "sse-probe-admin", passwordHash: hash, name: "Probe", role: "admin" },
});

const menu = (await (await fetch(`${BASE}/api/menu`)).json()).data as { id: number }[];
const created = (await (await fetch(`${BASE}/api/orders`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ customerName: "SSE-Probe", items: [{ menuItemId: menu[0].id, quantity: 1, selection: {} }] }),
})).json());
const orderId = created.order.id as number;
const token = created.orderToken as string;
console.log(`order id=${orderId}`);

const login = await fetch(`${BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "sse-probe-admin", password: "probe-pass" }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");

// open the stream and read frames with timestamps
const ac = new AbortController();
const res = await fetch(`${BASE}/api/orders/${orderId}/stream?token=${encodeURIComponent(token)}`, { signal: ac.signal });
const reader = res.body!.getReader();
const decoder = new TextDecoder();

const readFrames = (async () => {
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      const evLine = frame.split("\n").find((l) => l.startsWith("event:"));
      console.log(`frame  t=${Date.now()}  ${evLine ?? ""} ${dataLine ?? ""}`);
    }
  }
})();

await new Promise((r) => setTimeout(r, 2000));

for (const status of ["diproses", "siap_diambil", "selesai"]) {
  const t0 = Date.now();
  const st = await fetch(`${BASE}/api/admin/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ status }),
  });
  const t1 = Date.now();
  console.log(`PATCH ${status}: http=${st.status} took ${t1 - t0} ms (sent at ${t0})`);
  await new Promise((r) => setTimeout(r, 1500));
}

ac.abort();
await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
await prisma.adminUser.delete({ where: { id: admin.id } }).catch(() => {});
console.log("cleaned up");
process.exit(0);
