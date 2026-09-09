# API Contract — Kopi Senja

All responses: `{ success: boolean, error?: string, data?: T | null, ... }`. Errors use 4xx/5xx with `error` message. Admin routes require cookie `admin_session` (set by login; httpOnly, 8h). Money is integer Rupiah. Admin routes use numeric IDs; guest order tracking uses numeric ID + `orderToken` (see below).

## Public (guest)

### `GET /api/menu` → `{ data: MenuItem[] }`
Query: `category` (number id), `available` (`true`/`false`). Item shape:
```ts
interface MenuItem {
  id: number; name: string; description: string | null;
  price: number; imageUrl: string | null; available: boolean;
  categoryId: number; customizationOptions: string; // JSON: { sizes:[{name,priceDelta}], sugarLevels:[], iceLevels:[], extras:[{name,priceDelta}] }
  category: { id: number; name: string };
}
```

### `GET /api/menu/[id]` → `{ data: MenuItem }` | 404

### `POST /api/orders` → `201 { order, orderToken }` | 400/500
```ts
// request
{ customerName: string; tableNumber?: string;
  items: { menuItemId: number; quantity: number;
    selection: { size?: string; sugar?: string; ice?: string; extras?: string[] } }[] }
// Total recomputed server-side from DB prices. Order includes items array.
// orderToken is the unguessable tracking token — pass it to GET /api/orders/[id].
Order: { id: number; orderNumber: string; orderToken: string; customerName: string; tableNumber: string | null;
  status: "baru" | "diproses" | "siap_diambil" | "selesai"; totalPrice: number;
  createdAt: string; updatedAt: string;
  items: { id: number; menuItemId: number; quantity: number; itemName: string;
    unitPrice: number; subtotal: number; customization: string /*JSON string[]*/ }[] }
```

### `GET /api/orders/[id]?token=…` → `{ order: Order }` | 404
Requires the `orderToken` returned at creation. Missing/wrong token → 404 (order existence not revealed). Non-integer `id` → 404.

## Admin (cookie-auth; 401 if missing/invalid)

### `POST /api/admin/login` → `{ user }` + Set-Cookie | 401 wrong creds | 429 rate-limited
`{ username, password }` (bcrypt compare). Rate limit: 5 failed attempts / 15 min per IP (in-memory), fixed 500ms delay on failure. `user: { id, username, name, role: "admin" | "kasir" }`

### `POST /api/admin/logout` → `{ success: true }` (clears cookie)

### `GET /api/admin/session` → `{ user }` | 401

### `GET /api/admin/menu` → `{ data: MenuItem[] }` (admin list; newest first)

### `POST /api/admin/menu` → `201 { data: MenuItem }` | 400/403
`{ name, categoryId, price, description?, imageUrl?, available?, customizationOptions? }`

### `PUT /api/admin/menu/[id]` → `{ data: MenuItem }` (partial — omitted fields keep DB values) | 400/404

### `DELETE /api/admin/menu/[id]` → `{ success: true }` | 404

### `GET /api/admin/orders` → `{ data: Order[] }` (newest first, max 100, items included)

### `PATCH /api/admin/orders/[id]` → `{ data: Order }` | 400/404
`{ status }` — **forward-only**: new status must equal `nextStatus(current)`; 400 otherwise. Selesai is terminal.

### `GET /api/admin/stats` → `{ data: Stats }`
```ts
{ ordersToday: number; revenueToday: number; waitingCount: number; // status = baru
  topProducts: { name: string; quantity: number; revenue: number }[]; // today, top 5
  recentOrders: Order[] }                                             // top 8
```

### `GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` → `{ data: Report }`
```ts
{ totalOrders: number; revenue: number; avgOrder: number;
  topProducts: { name; quantity; revenue }[];  // top 8
  daily: { date: string /*YYYY-MM-DD*/; revenue: number }[] }
```

## Status Flow
`baru` → `diproses` → `siap_diambil` → `selesai` (labels/colors in `src/lib/format.ts`).
`orderNumber` = zero-padded day sequence (`#0001`…).