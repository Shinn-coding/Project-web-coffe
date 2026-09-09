# Implementation Summary — Kopi Kita (Coffee Shop Online Ordering)

Next.js 15 (App Router) + TypeScript + Prisma 6 (SQLite) + Tailwind v4 + Zustand 5 + Radix UI. Built by `frontend-react`.

## How to Run

```bash
npm install
npx prisma migrate deploy      # apply migrations to prisma/dev.db
npx prisma db seed             # 3 categories / 16 menu items / admin user
npm run dev                    # http://localhost:3000
```

Admin login: `admin` / `admin123` (at `/admin/login`).

## Pages & Routes

| Route | Type | Purpose |
| --- | --- | --- |
| `/` | Server → client (`MenuClient`) | Menu: search (300ms debounce), category chips, cards, customization modal, cart drawer, sticky cart bar |
| `/checkout` | client | Name + optional table, order summary, POST → `/api/orders` |
| `/order/[id]` | client | Success receipt, status timeline (Baru→Diproses→Siap→Selesai), polls `/api/orders/[id]` every 5s |
| `/admin/login` | client | Session login (signed-cookie HMAC, 8h) |
| `/admin` | client | Dashboard: today's orders/revenue/waiting + top product + recent orders (auto-refresh 10s) |
| `/admin/orders` | client | Inbox: advance status forward only; order-inbox live via SSE (8s poll fallback), new-order toast pulse |
| `/admin/menu` | client | CRUD: availability switch, edit modal, delete, JSON customization options |
| `/admin/reports` | client | Date range: totals, daily revenue char, top products |
| API | see `api-contract.md` | `/api/menu`, `/api/menu/[id]`, `/api/orders`, `/api/orders/[id]`, `/api/admin/{login,logout,session,menu,orders,stats,reports}`, `/api/admin/orders/stream` |

## State & Data Handling

- **Cart**: Zustand with `persist` middleware, localStorage key `coffee-cart`. `CartItem.key` unique per item+customization combo; extras merged/up-counted. `cartCount`/`cartSubtotal` as pure helpers.
- **Customization**: `MenuClient` renders `<CustomizationModal key={item.id}>` so selection state resets per open item; drinks (`hasRequiredOptions` true) open modal, pastries add directly with empty selection. Totals computed live via `selectionDelta`.
- **Order total is computed server-side** in `POST /api/orders` from the DB menu prices (never trusts client totals), snapshotting name/unitPrice/subtotal/customization strings into `OrderItem`.
- **Order tracking is token-gated**: each order gets an unguessable `orderToken` (crypto.randomUUID, unique column) at creation; checkout redirects to `/order/[id]?token=…`; `GET /api/orders/[id]` requires the token (missing/wrong → 404, existence not revealed). Admin routes still use numeric IDs.
- **Order numbers are race-safe**: unique constraint on `orderNumber` + create retries once on P2002 (recounts the day sequence).
- **Admin login is rate-limited**: in-memory Map, 5 failed attempts / 15 min per IP, fixed 500ms failure delay (single-process only; multi-instance needs Redis/DB).
- **Input hardening**: `available` on menu PUT is type-checked (`typeof === "boolean"`); all `[id]` routes reject non-integer IDs with 404; `.env*` added to `.gitignore`.
- **Status advance is forward-only** (`nextStatus` in `src/lib/format.ts`): Baru → Diproses → Siap Diambil → Selesai; admin PATCH rejects skips.
- New-order real-time: `POST /api/orders` triggers `emitNewOrder` → SSE `/api/admin/orders/stream` → EventSource on `/admin/orders` inbox table (toast + live row); 8s poll stays as fallback.
- **Admin auth**: signed cookie `admin_session` (HMAC-SHA256 + `timingSafeEqual`, `AUTH_SECRET`, 8h expiry). Server-side guard `requireAdmin()` on admin API routes; `/admin` pages guard via client-side `/api/admin/session` fetch (layout skips `/admin/login`).

## Key Files

- `src/app/` — 9 pages + 13 API route handlers
- `src/components/ui/` — button, input, skeleton, spinner, sheet (Radix), status-badge, switch (Radix), stepper, toast
- `src/components/customer/` — menu-client, menu-card, customization-modal, cart-drawer, cart-bar, search-bar, category-tabs, item-options
- `src/lib/` — prisma (singleton), auth, admin-guard, format, customization, types, utils, store/cart
- `prisma/seed.ts`, `prisma/schema.prisma` (utils as provided)

## Verified

- `npx tsc --noEmit` ✅ / `npm run build` ✅ / `npm run lint` ✅ / `npx prisma validate` ✅
- Runtime smoke: menu fetch, order POST (#0001, correct server total + spec strings), status advance, stats/reports, admin CRUD, 401 without session — all passed; DB reset to seed after testing.
- Seed: 3 categories, 16 items, 1 admin. Money is integer Rupiah via `formatRupiah`.

## FE-002 — next/image polish (Q2 from review-report.md)

- Replaced raw `<img>` with `next/image` in:
  - `src/components/customer/menu-card.tsx` (customer menu card)
  - `src/app/admin/menu/page.tsx` (admin menu table row thumbnail)
- New shared component `src/components/ui/menu-item-image.tsx` — uses `next/image` `fill` (parent must be relative + sized) with graceful fallback: `ImageOff` placeholder tile on missing (`src` null) or broken (`onError`) images, no layout shift.
- `next.config.ts` — added `images.remotePatterns` for `source.unsplash.com` and `images.unsplash.com` (seed image URLs).
- Design tokens preserved (radius-sm / surface-2 / muted / object-cover); the admin "Habis" grayscale treatment on unavailable items kept via className passthrough.
- No API routes, data fetching, or layout/design changed.