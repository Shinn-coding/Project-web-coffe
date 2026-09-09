# Spec: Kopi Senja — Menu Grid & Polish Fixes

**Status:** ready for implementation (Phase 2)
**Author:** @designer
**Consumer:** @frontend → read `DESIGN.md` + `specs/ui-specs.md` + this file
**Out of scope (do NOT touch):** order flow, auth, admin CRUD logic, API contracts, `prisma/schema.prisma`

---

## Fix 1 — Menu grid always 2 columns

**Problem:** `menu-client.tsx:129` uses `grid grid-cols-1 sm:grid-cols-2 gap-3`. Below 640px viewport the grid is 1 column even though the container (`max-w-[480px]`) fits two. 16 seed items = 8 even rows, no orphan.

**Change:**
- `menu-client.tsx:129`: `grid grid-cols-1 sm:grid-cols-2 gap-3` → `grid grid-cols-2 gap-3` (unconditional, mobile-first).
- Skeleton loading block (~`menu-client.tsx:176`) uses the SAME classes — update it too, or the phase shift between skeleton and content is visible.

**Rules:**
- Keep `gap-3` (12px, matches design tokens).
- Only header nav and search wrapper may be `sticky`/`fixed`. Cards stay plain buttons — do not add sticky/fixed to cards.
- Card proportion on 2-col: `aspect-[3/4]` max; keep text at base size so lines don't wrap awkwardly on narrow phones (320px → ~140px card width). Verify 16 items → no orphan row.

---

## Fix 2 — Sticky search bleed (scrolling card content visible through sticky band)

**Problem:** search wrapper (`menu-client.tsx:115`) is `sticky top-[57px] z-30` with `bg-bg/95 backdrop-blur` + `-mx-4` for full-width bleed. Because the band is only 95% opaque, card text/content scrolling beneath shows through (and backdrop-blur smears it). Same applies to header `sticky top-0 z-40` if it uses translucency.

**Change:**
- Sticky bands: `bg-bg/95 backdrop-blur` → solid `bg-bg` (fully opaque). Drop `backdrop-blur` (pointless once opaque; keeps perf).

Replace like: `bg-bg/95 backdrop-blur` → `bg-bg`.

- Add `isolate` on the page `main`/root container so sticky bands create a self-contained stacking context (cards can't stack above them regardless of z-index changes later).
- Keep z-order: header `z-40` > search `z-30`.
- `top-[57px]` hardcodes header height. It works today (header is 57px) but note the coupling: if header height changes, `top-[57px]` must follow. Acceptable — no abstraction needed.

---

## Fix 3 — Valid image URLs in seed

**Problem:** `prisma/seed.ts:10` — `const img = (q: string) => \`https://source.unsplash.com/400x400/?${q}\``. `source.unsplash.com` is shut down; every seeded image URL is dead.

**Change contract (frontend: rewrite the `img` helper, then re-seed):**

```ts
// prisma/seed.ts
// 1:1 crop via images.unsplash.com CDN. photo-* IDs below are verified.
const img = (id: string) =>
  `https://images.unsplash.com/${id}?w=400&h=400&fit=crop&auto=format`
```

Verified photo IDs to use per item (espresso, cold brew, lemon tea, hot chocolate, banana bread, cinnamon roll, red velvet, macchiato still need implementer verification — swap in a working photo-* for the subject or fall back to Plan B):

| Item | photo ID |
| --- | --- |
| Espresso | TBD (verify) |
| Americano | `photo-1509042239860-f550ce710b93` |
| Cappuccino | `photo-1570968915860-54d5c301fa9f` |
| Caffe Latte | `photo-1541167760496-1628856ab772` |
| Caramel Macchiato | TBD (verify) |
| Cold Brew | TBD (verify) |
| Matcha Latte | `photo-1536256263959-770b48d82b0a` |
| Cokelat Panas | TBD (verify) |
| Thai Tea | `photo-1561047029-3000c95639a7` |
| Lemon Tea | TBD (verify) |
| Red Velvet | TBD (verify) |
| Croissant | `photo-1555507036-ab1f4038808a` |
| Banana Bread | TBD (verify) |
| Cheesecake | `photo-1524351199678-941a58a3df50` |
| Cinnamon Roll | TBD (verify) |
| Matcha Croissant | `photo-1495474472287-4d71bcdd2085` |

**Rules:**
- Verify EVERY photo ID renders (open in browser or `curl -I` — expect 200).
- Keep 400x400 1:1; `MenuItemImage` (`src/components/ui/menu-item-image.tsx`) already has a broken-image fallback — do not remove it. It is the safety net for anything still 404ing after reseed.
- After editing seed: `npx prisma db seed` (or `npm run seed` if scripted). Re-verify the menu page images render.
- **Plan B** if a subject has no usable Unsplash ID: local placeholder `public/images/menu/{slug}.jpg` (1:1, min 400x400) and point the seed at `/images/menu/{slug}.jpg`. Prefer Plan B only for the 8 TBD items that can't be verified.

---

## Fix 4 — Brand rename: Kopi Kita → Kopi Senja

Table (grep "Kopi Kita" — exact targets):

| File | Line | Current | New |
| --- | --- | --- | --- |
| `src/components/customer/menu-client.tsx` | 82 | `Kopi Kita` (h1, `text-base font-bold text-ink`) | `Kopi Senja` |
| `src/app/layout.tsx` | 11 | title `Kopi Kita — Pesan Online` | `Kopi Senja — Pesan Online` |
| `src/app/admin/layout.tsx` | 76 | `Kopi Kita Admin` | `Kopi Senja Admin` |
| `src/app/admin/login/page.tsx` | 49 | `Kopi Kita — Admin` | `Kopi Senja — Admin` |

Rules:
- Replace only the word "Kopi Kita" in these 4 files. Do not change surrounding copy, classes, or layout.
- Optional (only if trivial): update `specs/implementation-summary.md:1` and `api-contract.md:1` references for consistency.
- IGNORE matches in `.next/static/chunks/**` — build artifacts, regenerate by running the next build.

---

## Verification (Phase 2 exit criteria — run before handing back)

1. `npx tsc --noEmit` passes; no console.log added.
2. Grid: 2 columns at viewport 320px and 480px; skeleton matches content phase; 16 items → 8 rows.
3. Sticky: scroll menu → header/search stay clean (no card text bleeding through), no visual blur artifacts.
4. Images: all 16 menu items render a photo; no broken-image placeholders; verify with `curl -I` each photo URL.
5. Brand: "Kopi Kita" absent from `src/app` and `src/components` (`grep -ri "kopi kita" src` → no matches).
6. `npx next build` succeeds (regenerates `.next`).

Report `verified` / `partially_verified` / `not_verified` per item in `specs/implementation-summary.md`.