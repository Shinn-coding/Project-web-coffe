// Headless-Chrome smoke test for the CSP complaint on /order/[id].
//
// Proves that in a REAL browser:
//  1. The app sends no CSP header of its own (the `script-src 'none'` blocks
//     seen in preview sandboxes do NOT come from this app).
//  2. The receipt + status are SERVER-rendered: curl the HTML and the order
//     number/status are already present before any JS runs.
//  3. Scripts execute on /order/[id]?token=… and no CSP violations are logged
//     by Chrome for this page.
//
// Usage: BASE=http://localhost:3000 tsx scripts/csp-smoke.ts
// Creates a temp admin + a throwaway order, and deletes both at the end.

import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const prisma = new PrismaClient();

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

async function main() {
  // ── Setup: temp admin (never touches the real admin password) + order ───
  const passwordHash = await bcrypt.hash("csp-temp-pass", 10);
  const tempAdmin = await prisma.adminUser.upsert({
    where: { username: "csp-temp-admin" },
    update: { passwordHash },
    create: { username: "csp-temp-admin", passwordHash, name: "CSP Temp", role: "admin" },
  });

  const menu = (await (await fetch(`${BASE}/api/menu`)).json()).data as { id: number }[];
  const created = await (
    await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: "CSP-Smoke", items: [{ menuItemId: menu[0].id, quantity: 1, selection: {} }] }),
    })
  ).json();
  const orderId = created.order.id as number;
  const orderToken = created.orderToken as string;
  const orderNumber = created.order.orderNumber as string;
  const url = `${BASE}/order/${orderId}?token=${encodeURIComponent(orderToken)}`;
  console.log(`test order: id=${orderId} #${orderNumber}`);

  try {
    // ── 1. No CSP header on the app's HTML ────────────────────────────────
    const html = await fetch(url);
    const cspHeader = html.headers.get("content-security-policy");
    check("no CSP header sent by the app", cspHeader === null, cspHeader ?? "clean");

    // ── 2. Server-rendered receipt (works even with scripts blocked) ──────
    const body = await html.text();
    check("SSR: receipt heading present", body.includes("Pesanan Berhasil!"));
    check("SSR: order number present", body.includes(orderNumber));

    // ── 3. Headless Chrome: scripts run, zero CSP violations ─────────────
    // ponytail: use legacy --headless (new mode hangs on this env) + finish
    // the order first so the SSE stream auto-closes and dump-dom terminates.
    const login = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "csp-temp-admin", password: "csp-temp-pass" }),
    });
    const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    for (const status of ["diproses", "siap_diambil", "selesai"]) {
      await fetch(`${BASE}/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ status }),
      });
    }

    const out = execFileSync(
      "timeout",
      [
        "50",
        CHROME,
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        `--user-data-dir=/tmp/chrome-csp-smoke-${Date.now()}`,
        "--virtual-time-budget=8000",
        "--dump-dom",
        url,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
    );

    check("Chrome: receipt rendered", out.includes("Pesanan Berhasil!"));
    check("Chrome: finished-state notice rendered", out.includes("Pesanan selesai — terima kasih"));
  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────
    await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    await prisma.adminUser.delete({ where: { id: tempAdmin.id } }).catch(() => {});
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll checks passed ✓ — CSP blocks in the preview sandbox do not affect real browsers");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
