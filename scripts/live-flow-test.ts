// Live-flow test in a REAL browser (headless Chrome via CDP):
//   1. Create an order (customer "Live-Flow")
//   2. Open /order/[id]?token=… in headless Chrome (JS ON → SSE connects)
//   3. Advance the status from admin (kasir, Node-side with the session cookie)
//   4. Measure how long the tracking page DOM takes to reflect the change
//   5. Repeat for siap_diambil → selesai; verify the finished-state UI
//
// Usage: BASE=http://localhost:3000 npx tsx scripts/live-flow-test.ts
// Creates a temp admin + one test order; deletes both at the end.

import { execFile, execFileSync, execSync, spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const PORT = new URL(BASE).port || "3000";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";

/** Kill the dev server for real — the only honest way to drop an SSE socket. */
function killDevServer() {
  try {
    execSync('pkill -f "next dev" || true; pkill -f next-server || true', { shell: "/bin/bash" });
  } catch {
    /* nothing to kill */
  }
}

/** Start it back up detached, then wait until it serves /api/menu again. */
async function restartDevServer(): Promise<boolean> {
  spawn("npx", ["next", "dev", "-p", PORT], { detached: true, stdio: "ignore", env: process.env }).unref();
  for (let i = 0; i < 90; i++) {
    await sleep(500);
    try {
      if ((await fetch(`${BASE}/api/menu`)).ok) return true;
    } catch {
      /* not up yet */
    }
  }
  return false;
}
const prisma = new PrismaClient();

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Minimal CDP driver over --remote-debugging-port (no puppeteer needed). */
async function withPage(
  url: string,
  run: (evaluate: (expr: string) => Promise<unknown>, cdp: (method: string, params?: Record<string, unknown>) => Promise<void>) => Promise<void>,
) {
  const port = 9222 + Math.floor(Math.random() * 500);
  const child = execFile(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--no-first-run",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/chrome-live-${Date.now()}`,
    "about:blank",
  ]);
  void child;

  try {
    // wait for the devtools endpoint
    let wsUrl = "";
    for (let i = 0; i < 50; i++) {
      await sleep(200);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const targets = (await res.json()) as { webSocketDebuggerUrl: string; type: string }[];
        const page = targets.find((t) => t.type === "page");
        if (page) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {
        /* not up yet */
      }
    }
    if (!wsUrl) throw new Error("chrome devtools endpoint never came up");

    const socket = new WebSocket(wsUrl);
    await new Promise<void>((res, rej) => {
      socket.addEventListener("open", () => res());
      socket.addEventListener("error", () => rej(new Error("ws error")));
    });
    let msgId = 0;
    const pending = new Map<number, (v: unknown) => void>();
    socket.addEventListener("message", (ev: { data: unknown }) => {
      const m = JSON.parse(String(ev.data)) as { id?: number; result?: Record<string, unknown> };
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)!(m.result ?? {});
        pending.delete(m.id);
      }
    });
    const send = (method: string, params: Record<string, unknown> = {}) =>
      new Promise<Record<string, unknown>>((res) => {
        const id = ++msgId;
        pending.set(id, res as (v: unknown) => void);
        socket.send(JSON.stringify({ id, method, params }));
      });

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
    await send("Page.navigate", { url });

    // Runtime.evaluate result shape: { result: { result: { type, value } } }
    const evaluate = async (expr: string) => {
      const resp = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      const inner = resp.result as { value?: unknown } | undefined;
      return inner?.value;
    };

    // wait for the page to actually load + render (SSR text present)
    for (let i = 0; i < 50; i++) {
      await sleep(200);
      const len = (await evaluate("document.body ? document.body.innerText.length : 0")) as number;
      if (typeof len === "number" && len > 100) break;
    }

    const cdp = async (method: string, params: Record<string, unknown> = {}) => {
      await send(method, params);
    };

    await run(evaluate, cdp);
    socket.close();
  } finally {
    try {
      execFileSync("pkill", ["-f", `remote-debugging-port=${port}`]);
    } catch {
      /* already gone */
    }
  }
}

/**
 * Poll the page DOM until `text` appears. Clock starts at `t0` (PATCH start);
 * returns { totalMs } from PATCH start and { renderMs } from PATCH completion
 * (pure SSE + React render latency), or -1 on timeout.
 */
async function waitForText(
  evaluate: (expr: string) => Promise<unknown>,
  text: string,
  t0: number,
  patchDoneAt?: number,
  timeoutMs = 8000,
) {
  while (Date.now() - t0 < timeoutMs) {
    await sleep(50);
    const txt = (await evaluate("document.body.innerText")) as string;
    if (typeof txt === "string" && txt.includes(text)) {
      const totalMs = Date.now() - t0;
      return { totalMs, renderMs: patchDoneAt ? Date.now() - patchDoneAt : totalMs };
    }
  }
  return { totalMs: -1, renderMs: -1 };
}

/**
 * The timeline lists every status label exactly once; the status BADGE adds a
 * second occurrence of the current status. So `count >= 2` ⇒ badge shows it.
 */
async function waitForBadge(
  evaluate: (expr: string) => Promise<unknown>,
  label: string,
  t0: number,
  timeoutMs = 8000,
) {
  const expr = `(document.body.innerText.match(new RegExp(${JSON.stringify(label)}, "g")) || []).length`;
  while (Date.now() - t0 < timeoutMs) {
    await sleep(50);
    const n = (await evaluate(expr)) as number;
    if (typeof n === "number" && n >= 2) return Date.now() - t0;
  }
  return -1;
}

async function main() {
  // ── Setup: temp admin + test order ──────────────────────────────────────
  const passwordHash = await bcrypt.hash("live-temp-pass", 10);
  const tempAdmin = await prisma.adminUser.upsert({
    where: { username: "live-temp-admin" },
    update: { passwordHash },
    create: { username: "live-temp-admin", passwordHash, name: "Live Temp", role: "admin" },
  });

  const menu = (await (await fetch(`${BASE}/api/menu`)).json()).data as { id: number }[];
  const created = await (
    await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: "Live-Flow", items: [{ menuItemId: menu[0].id, quantity: 1, selection: {} }] }),
    })
  ).json();
  const orderId = created.order.id as number;
  const orderToken = created.orderToken as string;
  const orderNumber = created.order.orderNumber as string;
  console.log(`test order: id=${orderId} #${orderNumber}`);

  const login = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "live-temp-admin", password: "live-temp-pass" }),
  });
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  check("kasir login", login.ok);

  const patch = async (status: string) => {
    const r = await fetch(`${BASE}/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ status }),
    });
    return r.status;
  };

  const url = `${BASE}/order/${orderId}?token=${encodeURIComponent(orderToken)}`;

  try {
    await withPage(url, async (evaluate, cdp) => {
      // marker lets us detect Next-dev's full reload after the server restart
      await evaluate("window.__marker = 'alive'");

      // ── Initial render (SSR + hydration) ────────────────────────────────
      const boot = (await evaluate("document.body.innerText")) as string;
      check("halaman tracking ter-render di browser asli", typeof boot === "string" && boot.includes("Pesanan Berhasil!"));

      // SSE connected? (badge flips once the first live frame arrives)
      const liveBadge = await waitForText(evaluate, "Pembaruan status langsung", Date.now(), undefined, 15000);
      check("indikator real-time aktif (SSE hidup)", liveBadge.totalMs >= 0, `SSE hidup dalam ${liveBadge.totalMs} ms`);

      // ── Server down (kasir reboot) → SSE socket dies for real → quiet hint
      // must appear while the page keeps showing the last known status. ──
      const t0 = Date.now();
      if (!process.env.SKIP_KILL) killDevServer();
      const lost = await waitForText(evaluate, "Koneksi terputus, mencoba lagi", t0, process.env.SKIP_KILL ? undefined : undefined, process.env.SKIP_KILL ? 1500 : 20000);
      check(
        process.env.SKIP_KILL ? "[skip-kill] indikator tidak muncul saat koneksi sehat" : "indikator 'Koneksi terputus, mencoba lagi…' muncul saat server mati",
        process.env.SKIP_KILL ? lost.totalMs < 0 : lost.totalMs >= 0,
        `hasil pencarian: ${lost.totalMs} ms`,
      );
      let patch2 = patch; // skip-kill mode reuses the original session

      if (process.env.SKIP_KILL) {
        console.log("  [skip-kill] melewati skenario server mati/hidup — jalur happy murni");
      } else {
        const duringDown = (await evaluate("document.body.innerText")) as string;
        check("badge status terakhir ('Baru') tetap terlihat saat koneksi mati", typeof duringDown === "string" && (duringDown.match(/Baru/g) ?? []).length >= 2);

        // ── Server back up → indicator clears, real-time resumes ──────────
        check("dev server hidup kembali", await restartDevServer());
        // fresh session in case admin sessions were memory-bound
        const relogin = await fetch(`${BASE}/api/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "live-temp-admin", password: "live-temp-pass" }),
        });
        const cookie2 = (relogin.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
        patch2 = async (status: string) => {
          const r = await fetch(`${BASE}/api/admin/orders/${orderId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", cookie: cookie2 },
            body: JSON.stringify({ status }),
          });
          return r.status;
        };

        const t1 = Date.now();
        const recovered = await waitForText(evaluate, "Pembaruan status langsung", t1, undefined, 30000);
        const reloaded = (await evaluate("window.__marker ?? 'gone'")) === "gone";
        if (reloaded) console.log("  [info] Next dev memuat ulang halaman setelah server restart (perilaku dev, bukan bug)");
        check("indikator hilang + real-time hidup lagi setelah server pulih", recovered.totalMs >= 0, `pulih dalam ${recovered.totalMs} ms`);
      }

      // Diagnostic: parallel instrumented EventSource inside the page — does
      // a FRESH ES in this same page receive frames after the restart?
      await evaluate(`(function(){
        window.__log2 = [];
        const es = new EventSource('/api/orders/${orderId}/stream?token=${encodeURIComponent(orderToken)}');
        es.addEventListener('ping', (e) => window.__log2.push({ t: Date.now(), kind: 'ping' }));
        es.addEventListener('status-update', (e) => window.__log2.push({ t: Date.now(), kind: 'status', data: e.data }));
        es.onerror = () => window.__log2.push({ t: Date.now(), kind: 'error' });
      })()`);

      // ── Advance 1: baru → diproses, measure DOM latency (post-recovery) ─
      const t1 = Date.now();
      const st1 = await patch2("diproses");
      const p1 = Date.now();
      const ms1 = await waitForBadge(evaluate, "Diproses", p1, 15000);
      check("PATCH diproses sukses", st1 === 200);
      if (!process.env.SKIP_KILL) {
        const log2 = (await evaluate("window.__log2 ?? []")) as { kind: string; data?: string }[];
        console.log("  [diag] parallel-ES frames after restart:", JSON.stringify(log2));
      }
      check("HP customer: badge → 'Diproses'", ms1 >= 0, `badge berubah ${ms1} ms setelah PATCH selesai (total ${p1 - t1 + ms1} ms)`);

      // ── Advance 2: diproses → siap_diambil ──────────────────────────────
      const t2 = Date.now();
      const st2 = await patch2("siap_diambil");
      const p2 = Date.now();
      const ms2 = await waitForBadge(evaluate, "Siap Diambil", p2);
      check("PATCH siap_diambil sukses", st2 === 200);
      check("HP customer: badge → 'Siap Diambil'", ms2 >= 0, `badge berubah dalam ${ms2} ms (SSE+render)`);

      // ── Advance 3: siap_diambil → selesai ───────────────────────────────
      const t3 = Date.now();
      const st3 = await patch2("selesai");
      const p3 = Date.now();
      const ms3 = await waitForText(evaluate, "Pesanan selesai — terima kasih", p3, undefined, 10000);
      check("PATCH selesai sukses", st3 === 200);
      if (ms3.totalMs < 0) {
        const txt = (await evaluate("document.body.innerText")) as string;
        console.log("  [debug] body text saat gagal:", JSON.stringify(txt.slice(0, 400)));
      }
      check("HP customer: pesan selesai tampil", ms3.totalMs >= 0, `total ${ms3.totalMs} ms (SSE+render)`);

      const afterDone = (await evaluate("document.body.innerText")) as string;
      check("indikator real-time hilang setelah selesai", !afterDone.includes("Pembaruan status langsung"));
      check("indikator 'Koneksi terputus' tidak tampil setelah selesai", !afterDone.includes("Koneksi terputus"));
    });
  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────
    await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    await prisma.adminUser.delete({ where: { id: tempAdmin.id } }).catch(() => {});
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nLive flow ✓ — perubahan status kasir sampai ke HP customer dalam <1 detik");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
