# UI Specs — Coffee Shop Ordering

Per-component implementation specs. Read `DESIGN.md` first for tokens. All colors/spacing reference DESIGN.md tokens. Frontend agents build to this.

**Stack**: Next.js (App Router), Tailwind. Use shadcn/ui primitives restyled to these tokens.

---

## CUSTOMER SIDE

### 1. Menu Page (layout)

```
Mobile (phone):
┌─────────────────────────────┐
│ Sticky header: brand + cart icon + count  │
├─────────────────────────────┤
│ Search bar (sticky)          │
├─────────────────────────────┤
│ Category tab chips (horizontal scroll)    │
├─────────────────────────────┤
│ Menu cards (1 col)           │
│ ...                          │
├─────────────────────────────┤
│ Sticky bottom bar: "Cart · 3 • Rp 45k"  │
└─────────────────────────────┘
```

- Header: brand (shop name), right = cart button showing item count badge. Sticky top.
- Search input: sticky below header, debounced (300ms).
- Category chips: horizontal scroll row, single-pick (active = filled primary). Selected category filters menu.
- Bottom bar: `--color-primary` filled, shows total price + item count; opens cart drawer. Hidden when cart empty.
- Menu grid: 1 col mobile, 2 cols `sm`, 2–3 `md`.
- Loading: skeleton card grid (shimmer), not a center spinner.
- Empty state (no items in category): friendly message + "Lihat Semua" reset button.
- Error state: retry message, no stale ghost layout.

**States** — category chip: `default` (surface-2/`--radius-full`), `hover` (primary at 10% tint), `active` (primary filled, white text), `focus` (primary ring).

---

### 2. Menu Card

- Layout: image (square, top) — or icon tile fallback; name (title) + short desc (body-sm muted) + price (subtitle) + **add button** (+) bottom-right.
- Shows: name, description (2-line clamp), price (Rp formatted, e.g. `Rp 18.000`), a colored availability state:
  - **Available with options** → `+` add button opens customization.
  - **Sold out** → name muted, image grayscale, badge "Habis", add button disabled.
- Click anywhere on card opens customization modal (or adds directly if no required options — see Customization).
- Quantity already in cart: card shows a small "x in cart" count chip.

**States**: default, hover (shadow-md + border primary, lift -1px), focus (ring), disabled/habis, loading (skeleton), added-to-cart (brief check on button).

---

### 3. Category Filter Tabs

- Horizontal scrollable chip row under search.
- Optional "Semua" (all) chip at the front.
- Each category gets a small colored dot when it has a signature color (e.g. matcha = `--color-accent`); otherwise neutral.
- Active chip = `--color-primary` filled, white text, `--radius-full`.

---

### 4. Search Bar

- Input with search icon (left), trailing clear "×" button when non-empty.
- Debounced 300ms; no debounce visible loading jitter — show skeleton on full page only after 300ms idle.
- Placeholder: `Cari menu…` — placeholder must meet 4.5:1 contrast (`--color-muted`).
- No results → empty state: `Menu tidak ditemukan` + suggestion to clear search.
- Focus state: 2px `--color-primary` ring + bg white.

---

### 5. Customization Modal (per-item options)

Opens when adding an item with options. Single-pick grouped controls.

**Group: Ukuran (Size)** — segmented control, single-pick, required, default `Reguler`:
- Reguler / Large / (e.g.)
- Each changes base price (show `+ Rp 3.000` suffix on Large).

**Group: Level Gula (Sugar)** — segmented control, single-pick, required, default `Normal`:
- Tanpa Gula (No sugar) / Sedikit (Less) / Normal / Manis (Sweet).

**Group: Es (Ice)** — segmented control, single-pick, default `Es Normal`:
- Tanpa Es (No ice) / Es Sedikit (Less) / Es Normal (Normal) / Es Banyak (Extra).

**Group: Tambahan (Extras)** — multi-select checkable chips:
- Extra Shot (+Rp 5.000) / Topping Sew (e.g. bobas, whipped cream) each with `+Rp` suffix.

**Quantity stepper** — `-` / count / `+`, min 1, brief max (e.g. 9). 44px touch targets.

**TOTAL** row at bottom: computed price (base + size delta + extras) × quantity.
**Primary button**: "Tambahkan • Rp X". Disabled if no required option selected (never — defaults chosen, so always enabled).

Behavior: options default-selected so the button is always valid (reduces decision cost — design principle 1). Picking a required group is always possible. "Sesuaikan" always opens modal if the item has required groups; items with NO required options add directly in one tap.

**Sheet placement**: bottom sheet on mobile (slide up), centered modal on md+.

Accessibility: `role="dialog"` `aria-modal`, focus trap, Escape closes, returns focus to the add button.

---

### 6. Cart Drawer

- Right-side drawer (desktop) / bottom sheet (mobile), 250ms slide-in.
- Header: "Keranjang (3)" + close ×.
- Order line items: name, customized specs line (e.g. "Large · Manis · Es Normal · +Bobas"), unit price, quantity stepper, line total, remove (trash icon).
- Line total = unit price (incl size/extras) × qty.
- Empty state: cart icon + "Keranjang kosong" + "Lihat Menu" button (empty states teach, don't just say "nothing here").
- Footer (always visible when items > 0): subtotal, "Checkout" primary button + "Lanjut Belanja" ghost.
- Badge on cart icon in header reflects total item count live.

**States**: open/close, item loading (qty update — subtle), item removed (row fade), empty.

---

### 7. Checkout Form

Minimal — just name + optional table number (design principle 1).

- **Nama** (required, text) — visible label + placeholder.
- **Nomor Meja** (optional, number) — only if the shop uses table service; placeholder "Contoh: 4".
- Order summary at top or side: list of items + totals (reuse cart rows, read-only).
- **Metode**: cash-only implied (checkout → barista receives). If online payment is out of scope, show a note "Bayar di kasir".
- Primary button **"Kirim Pesanan"** — loading spinner, then success.
- Disabled until name non-empty.
- Validation: name required; inline error message under field, field border = error color (`--color-status-error`, define as needed → use a red e.g. `oklch(0.600 0.180 25)`).
- On submit success → transition to Order Receipt.

---

### 8. Order Receipt / Tracking

After checkout — success state. Full screen (mobile) or centered card (desktop).

- Success icon (check) + "Pesanan Berhasil!"
- **Order number** large, e.g. `#0421`.
- Name used + estimated wait ("Sekitar 10 menit").
- Status timeline (stepper) of the status language: **Baru → Diproses → Siap Diambil → Selesai**, current step highlighted.
- Item summary.
- Note: "Tunjukkan nomor pesanan ini saat mengambil / simpan nomor ini." Suggest user waits at the counter/table.
- No login — order tracked by number only (client shows provided status; in scope is the receipt + current status, live updates via polling/SSE if backend supports).
- Live status update (if supported): subtle status step change with a one-time check pulse (respect reduced motion).
- **Stale/error**: if live status can't load, show last-known + "Periksa di kasir".

---

## ADMIN SIDE (login required)

### 9. Admin Layout

- Top bar: brand + admin nav + user/logout. Optional side nav on `lg`.
- Left side nav (desktop): **Dashboard**, **Pesanan**, **Menu**, **Laporan** (sales). Mobile: bottom tab bar or hamburger.
- Auth guard: all admin routes redirect to `/admin/login` when unauthenticated; session-protected.
- Loading/empty/error handled for every data section.

### 10. Login

- Center card, brand mark, fields: **Email**, **Password** (password toggle), **Login** button.
- Error: "Email atau password salah" inline, no data leak.
- Loading state on button; disabled empty.

---

### 11. Dashboard (overview)

- Stat cards row (4): **Pesanan Hari Ini**, **Pendapatan Hari Ini**, **Menunggu (Baru)**, **Menu Terlaris**.
- Stat card: overline label + large number + small delta (optional). **Cards ≠ the "hero-metric template"** — keep it plain: label + value.
- Recent orders list (compact, status badges + time).
- Loading: skeleton stat cards. Empty: dashboard still shows zeros with helpful text.

---

### 12. Order Status Badge (the status language — same as customer)

Rendered as pill: colored dot icon + text label. Soft fill variant on customer; can be stronger on admin.

| Status       | Pills                                   |
| ------------ | --------------------------------------- |
| Baru         | soft-green bg, green dot, `Baru`        |
| Diproses     | soft-amber bg, amber dot, `Diproses`    |
| Siap Diambil | soft-blue bg, blue dot, `Siap Diambil`  |
| Selesai      | soft-neutral bg, grey dot, `Selesai`    |

Never color-only; label + icon present.

---

### 13. Orders Inbox (real-time)

- List/table of incoming orders, newest first.
- Columns: Order #, Waktu, Nama, Items (compact), Total, Status, Aksi.
- Each row expandable → full order detail with line items + specs + table number.
- **New order arrives**: row highlighted / one-time subtle pulse + a toast "Pesanan baru #xxxx". Respect reduced motion.
- **Status advance**: primary action button per row cycles status (Baru → Diproses → Siap → Selesai) with a labeled dropdown or next-button; confirm not required for forward transitions.
- Loading: skeleton rows. Empty: "Belum ada pesanan" + teaching hint.
- Error: retry; auto-poll connection indicator ("Tersambung" / "Menyambung ulang…").

---

### 14. Menu Management Table

CRUD + availability toggle for menu items.

- Columns: Menu (image+name), Kategori, Harga, Stok/Tersedia (switch), Aksi (Edit / Hapus).
- **Availability toggle**: switch (on = available, green; off = "Habis", grey/disabled styling on customer side).
- **Add item**: button → form modal or inline panel (name, category, description, price, options: sizes & price deltas, extras, image upload).
- **Edit**: same form pre-filled.
- **Delete**: confirm dialog ("Hapus menu ini? Tindakan tidak bisa dibatalkan.") — protection.
- Loading skeleton rows; empty state "Belum ada menu, tambahkan yang pertama" + CTA; error retry.

---

### 15. Sales Report

- Date range picker (default today / this week).
- Simple aggregate cards: total orders, total revenue, average order value.
- Top products list (name + qty + revenue).
- Optional simple bar/line chart of daily revenue (keep native/lightweight).
- Export CSV button (if in scope) — plain button.
- Empty state when no sales in range.

---

## SHARED PRIMITIVES (restyled shadcn/ui)

- **Button**: variants `primary` (brown fill, white text) / `secondary` (surface-2 border) / `ghost` / `danger` (red); sizes sm(32px)/md(40px)/lg(48px); disabled (40% opacity, no shadow); loading (spinner + disable). Radius `--radius-md`.
- **Input**: bg white, 1px `--color-border`, radius `--radius-sm`, focus ring 2px primary, error variant, disabled (muted bg), radius.
- **Sheet**: cart + customization; max-width 420px (desktop drawer) / full-width bottom (mobile); `--radius-lg` corners on visible edge; backdrop `rgba(61,47,38,0.4)`.
- **Stepper**: 44px touch targets, ± buttons radius full, middle count min 1.
- **Segmented control**: group of pills, active = primary fill + white text, 44px targets.
- **Checkable chip** (multi-select): outline chip, selected = primary-tinted bg + border primary + check; used for toppings/extras.
- **Toast**: bottom-center (mobile) / top-right (desktop); success (check) / error (alert); auto-dismiss 3s for success, persistent for error; `--z-toast`; 200ms, reduced-motion crossfade.
- **Switch** (admin availability): track 20×12, thumb white, on = `--color-accent`, focus ring.

---

## States checklist (must handle for every interactive comp)

default · hover · focus · active · disabled · loading · empty · error.

## Responsive checklist

- Touch targets ≥44px (mobile).
- Cart bottom bar hidden when empty; always visible with content.
- Admin table: on mobile collapse to cards or horizontal scroll — never force 1200px onto a phone.
- Customer flow never requires desktop; admin is desktop-first but usable on tablet.
