// ponytail: E2E flow check for the 3 tasks — run while dev server is up.
// 1) admin creates menu with complex option groups (dynamic builder payload)
// 2) customer orders with choices → server recomputes price, snapshots specs
// 3) admin advances status to selesai → 5-min TTL auto-delete (customer side only)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";
const cookie: { value: string } = { value: "" };

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

async function api(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (cookie.value) headers.set("cookie", cookie.value);
  if (init?.body) headers.set("content-type", "application/json");
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie.value = setCookie.split(";")[0];
  const json = await res.json().catch(() => null);
  return { res, json };
}

async function main() {
  // ── 0. admin login ──
  const login = await api("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  if (!login.res.ok) fail(`admin login: ${login.res.status} ${JSON.stringify(login.json)}`);
  console.log("✓ admin login");

  // ── 1. create category + menu with complex option groups (builder payload) ──
  const cats = await api("/api/admin/menu");
  const categoryId = cats.json.data[0].categoryId;

  const groupsJson = JSON.stringify({
    groups: [
      { id: "g-0-ukuran", name: "Ukuran", type: "single", options: [{ name: "Kecil", priceDelta: 0 }, { name: "Besar", priceDelta: 5000 }] },
      { id: "g-1-topping", name: "Topping", type: "multiple", options: [{ name: "Boba", priceDelta: 3000 }, { name: "Cheese Foam", priceDelta: 4000 }] },
      { id: "g-2-manis", name: "Level Manis", type: "single", options: [{ name: "Less", priceDelta: 0 }, { name: "Normal", priceDelta: 0 }] },
    ],
  });
  const created = await api("/api/admin/menu", {
    method: "POST",
    body: JSON.stringify({
      name: `[E2E] Kopi Opsi Kompleks ${Date.now()}`,
      categoryId,
      price: 10000,
      available: true,
      customizationOptions: groupsJson,
    }),
  });
  if (!created.res.ok) fail(`create menu: ${created.res.status} ${JSON.stringify(created.json)}`);
  const menu = created.json.data;
  if (JSON.parse(menu.customizationOptions).groups?.length !== 3) fail("stored groups !== 3");
  console.log(`✓ menu created id=${menu.id} with 3 option groups`);

  // ── 2. customer order with choices (canonical selection) ──
  const order = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      customerName: "E2E Tester",
      tableNumber: "7",
      items: [
        {
          menuItemId: menu.id,
          quantity: 2,
          selection: { choices: { "g-0-ukuran": ["Besar"], "g-1-topping": ["Boba", "Cheese Foam"], "g-2-manis": ["Less"] } },
        },
      ],
    }),
  });
  if (!order.res.ok) fail(`create order: ${order.res.status} ${JSON.stringify(order.json)}`);
  // price check: (10000 + 5000 + 3000 + 4000 + 0) * 2 = 44000
  if (order.json.order.totalPrice !== 44000) fail(`totalPrice=${order.json.order.totalPrice}, expected 44000`);
  const specs = JSON.parse(order.json.order.items[0].customization);
  if (!specs.includes("Besar (+Rp 5.000)") || !specs.includes("Boba (+Rp 3.000)") || !specs.includes("Cheese Foam (+Rp 4.000)") || !specs.includes("Less")) {
    fail(`snapshot specs wrong: ${JSON.stringify(specs)}`);
  }
  // unknown option must be dropped server-side
  const orderBad = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      customerName: "E2E Bad",
      items: [{ menuItemId: menu.id, quantity: 1, selection: { choices: { "g-0-ukuran": ["HACKED"] } } }],
    }),
  });
  if (!orderBad.res.ok) fail(`bad-selection order rejected outright: ${orderBad.res.status}`);
  if (orderBad.json.order.totalPrice !== 10000) fail(`unknown option priced?! total=${orderBad.json.order.totalPrice}`);
  console.log(`✓ order id=${order.json.order.id} total=44000, specs snapshot ok; unknown options dropped`);

  // ── 3. legacy-format menu still orderable (backward compat) ──
  // ponytail: create the legacy menu here instead of hard-coding an id — menu ids
  // change whenever the dev DB is reseeded, which silently broke this step.
  const legacyMenu = await api("/api/admin/menu", {
    method: "POST",
    body: JSON.stringify({
      name: `[E2E] Legacy Fixed-Keys ${Date.now()}`,
      categoryId,
      price: 10000,
      available: true,
      customizationOptions: JSON.stringify({
        sizes: [{ name: "Small", priceDelta: 0 }, { name: "Large", priceDelta: 8000 }],
        sugarLevels: ["Less", "Normal"],
        iceLevels: ["Tanpa Es", "Es Normal"],
        extras: [],
      }),
    }),
  });
  if (!legacyMenu.res.ok) fail(`create legacy menu: ${legacyMenu.res.status} ${JSON.stringify(legacyMenu.json)}`);
  const legacy = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      customerName: "E2E Legacy",
      items: [{ menuItemId: legacyMenu.json.data.id, quantity: 1, selection: { size: "Large", sugar: "Normal", ice: "Es Normal", extras: [] } }],
    }),
  });
  if (!legacy.res.ok || legacy.json.order.totalPrice !== 18000) {
    fail(`legacy order: ${legacy.res.status} total=${legacy.json?.order?.totalPrice} (expected 18000)`);
  }
  console.log(`✓ legacy fixed-key menu still priced correctly (${legacy.json.order.totalPrice})`);

  // ── 4. admin advances status: baru → diproses → siap_diambil → selesai ──
  const oid = order.json.order.id;
  const otoken = order.json.orderToken;
  let status = order.json.order.status;
  const flow = ["diproses", "siap_diambil", "selesai"];
  for (const next of flow) {
    const r = await api(`/api/admin/orders/${oid}`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    if (!r.res.ok) fail(`advance to ${next}: ${r.res.status} ${JSON.stringify(r.json)}`);
    status = r.json.data.status;
  }
  if (status !== "selesai") fail(`final status=${status}`);
  console.log("✓ status advanced to selesai");

  // ── 5. customer status endpoint reflects selesai ──
  const track = await api(`/api/orders/${oid}?token=${encodeURIComponent(otoken)}`);
  if (!track.res.ok || track.json.order.status !== "selesai") fail("customer tracking endpoint failed");
  console.log("✓ customer GET /api/orders/[id] returns selesai");

  // ── 6. TTL prune logic (customer-side only; DB untouched) ──
  const pruneMod = await import("../src/lib/order-history");
  type Cache = Record<string, { status: string; fetchedAt: number }>;
  const cache: Cache = {};
  cache[order.json.order.orderNumber] = { status: "selesai", fetchedAt: Date.now() - 6 * 60 * 1000 }; // > 5 min
  cache["9999"] = { status: "selesai", fetchedAt: Date.now() - 6 * 60 * 1000 };
  cache["8888"] = { status: "selesai", fetchedAt: Date.now() - 1 * 60 * 1000 }; // < 5 min
  cache["7777"] = { status: "diproses", fetchedAt: Date.now() - 6 * 60 * 1000 };
  // emulate localStorage-backed entries
  const storage = new Map<string, string>();
  const g: Record<string, unknown> = globalThis;
  g.window = {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
  };
  storage.set(
    "orderHistory",
    JSON.stringify([
      { id: oid, orderNumber: order.json.order.orderNumber, orderToken: otoken, timestamp: new Date().toISOString() },
      { orderNumber: "9999", orderToken: "t9", timestamp: new Date().toISOString() },
      { orderNumber: "8888", orderToken: "t8", timestamp: new Date().toISOString() },
      { orderNumber: "7777", orderToken: "t7", timestamp: new Date().toISOString() },
    ]),
  );
  // seed status cache through the module's own writer
  for (const [num, s] of Object.entries(cache)) pruneMod.cacheOrderStatus(num, s.status, s.fetchedAt);
  const removed = pruneMod.pruneFinishedEntries();
  const left = JSON.parse(storage.get("orderHistory")!).map((e: { orderNumber: string }) => e.orderNumber);
  if (removed.length !== 2 || left.includes(order.json.order.orderNumber) || left.includes("9999")) {
    fail(`prune removed=${JSON.stringify(removed)} left=${JSON.stringify(left)}`);
  }
  if (!left.includes("8888") || !left.includes("7777")) fail(`prune kept wrong entries: ${JSON.stringify(left)}`);
  console.log(`✓ TTL prune: removed ${JSON.stringify(removed)}, kept fresh/unfinished entries`);

  // DB must still contain the order (admin permanence)
  const inDb = await prisma.order.findUnique({ where: { id: oid }, include: { items: true } });
  if (!inDb || inDb.status !== "selesai") fail("order missing from DB after prune");
  console.log("✓ order still in database (admin history permanent)");

  // ── 7. cleanup: delete test menu + orders ──
  await prisma.order.deleteMany({ where: { customerName: { in: ["E2E Tester", "E2E Bad", "E2E Legacy", "DebugBot"] } } });
  await prisma.menuItem.deleteMany({ where: { id: { in: [menu.id, legacyMenu.json.data.id] } } });
  console.log("✓ cleanup done");
  console.log("\nE2E FLOW CHECK PASSED");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
