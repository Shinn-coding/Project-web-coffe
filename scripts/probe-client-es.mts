// In-page probe: instrument EventSource inside the real tracking page and
// compare SSE frame arrival vs badge render. Isolates client-side delays.
// Usage: BASE=http://localhost:3000 npx tsx scripts/probe-client-es.mts
import { execFile, execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withPage(url: string, run: (evaluate: (expr: string) => Promise<unknown>) => Promise<void>) {
  const port = 9700 + Math.floor(Math.random() * 200);
  const child = execFile(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    "--no-first-run", `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/chrome-probe-${Date.now()}`, "about:blank",
  ]);
  void child;
  try {
    let wsUrl = "";
    for (let i = 0; i < 50; i++) {
      await sleep(200);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const targets = (await res.json()) as { webSocketDebuggerUrl: string; type: string }[];
        const page = targets.find((t) => t.type === "page");
        if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
      } catch { /* not up yet */ }
    }
    if (!wsUrl) throw new Error("devtools never came up");
    const socket = new WebSocket(wsUrl);
    await new Promise<void>((res, rej) => {
      socket.addEventListener("open", () => res());
      socket.addEventListener("error", () => rej(new Error("ws error")));
    });
    let msgId = 0;
    const pending = new Map<number, (v: unknown) => void>();
    socket.addEventListener("message", (ev: { data: unknown }) => {
      const m = JSON.parse(String(ev.data)) as { id?: number; result?: Record<string, unknown> };
      if (m.id && pending.has(m.id)) { pending.get(m.id)!(m.result ?? {}); pending.delete(m.id); }
    });
    const send = (method: string, params: Record<string, unknown> = {}) =>
      new Promise<Record<string, unknown>>((res) => {
        const id = ++msgId;
        pending.set(id, res as (v: unknown) => void);
        socket.send(JSON.stringify({ id, method, params }));
      });
    await send("Page.enable");
    await send("Runtime.enable");
    const evaluate = async (expr: string) => {
      const resp = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      return (resp.result as { value?: unknown } | undefined)?.value;
    };
    await send("Page.navigate", { url });
    for (let i = 0; i < 50; i++) {
      await sleep(200);
      const len = (await evaluate("document.body ? document.body.innerText.length : 0")) as number;
      if (typeof len === "number" && len > 100) break;
    }
    await run(evaluate);
    socket.close();
  } finally {
    try { execFileSync("pkill", ["-f", `remote-debugging-port=${port}`]); } catch { /* gone */ }
  }
}

const hash = bcrypt.hashSync("probe-pass", 10);
const admin = await prisma.adminUser.upsert({
  where: { username: "es-probe-admin" }, update: { passwordHash: hash },
  create: { username: "es-probe-admin", passwordHash: hash, name: "Probe", role: "admin" },
});
const menu = (await (await fetch(`${BASE}/api/menu`)).json()).data as { id: number }[];
const created = (await (await fetch(`${BASE}/api/orders`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ customerName: "ES-Probe", items: [{ menuItemId: menu[0].id, quantity: 1, selection: {} }] }),
})).json());
const orderId = created.order.id as number;
const token = created.orderToken as string;
console.log(`order id=${orderId}`);
const login = await fetch(`${BASE}/api/admin/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "es-probe-admin", password: "probe-pass" }),
});
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
const patch = async (status: string) => {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/admin/orders/${orderId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ status }),
  });
  return { st: r.status, t0, t1: Date.now() };
};

const url = `${BASE}/order/${orderId}?token=${encodeURIComponent(token)}`;
try {
  await withPage(url, async (evaluate) => {
    // Install an instrumented EventSource BEFORE the app's runs: since the page
    // module already executed, we open a second parallel ES to the same stream
    // and log its frames with timestamps — same registry, same server frames.
    await evaluate(`(function(){
      window.__log = [];
      const url = '/api/orders/${orderId}/stream?token=${encodeURIComponent(token)}';
      const es = new EventSource(url);
      const stamp = (ev, kind) => window.__log.push({ t: Date.now(), kind, status: (()=>{try{return JSON.parse(ev.data).status}catch{return null}})() });
      es.addEventListener('ping', (e) => stamp(e, 'ping'));
      es.addEventListener('status-update', (e) => stamp(e, 'status'));
      es.onerror = () => window.__log.push({ t: Date.now(), kind: 'error' });
    })()`);
    await sleep(1500);

    const p = await patch("diproses");
    console.log(`PATCH diproses: http=${p.st} took ${p.t1 - p.t0} ms (done at ${p.t1})`);

    // wait for the page badge to flip
    const expr = `(document.body.innerText.match(/Diproses/g) || []).length`;
    let badgeAt = -1;
    for (let i = 0; i < 200; i++) {
      await sleep(50);
      const n = (await evaluate(expr)) as number;
      if (typeof n === "number" && n >= 2) { badgeAt = Date.now(); break; }
    }
    const log = (await evaluate("window.__log")) as { t: number; kind: string; status: string | null }[];
    console.log("parallel-ES frames:", JSON.stringify(log));
    console.log(`badge flipped at: ${badgeAt}`);
    if (badgeAt > 0) {
      const frame = log.find((f) => f.kind === "status");
      if (frame) console.log(`=> parallel-ES status frame ${frame.t - p.t1} ms after PATCH; badge ${badgeAt - p.t1} ms after PATCH`);
    }
  });
} finally {
  await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
  await prisma.adminUser.delete({ where: { id: admin.id } }).catch(() => {});
}
process.exit(0);
