# DESIGN.md — Coffee Shop Ordering

Visual theme and design tokens for the coffee shop online ordering website.
Frontend agents MUST read this before implementing any screen. Specs live in `specs/ui-specs.md`.

**Mood** — *Sun through a cafe window at noon: warm espresso browns and cream on a clean white surface, a calm green thread for matcha, the busy-but-orderly rhythm of a good barista.*

**Register** — Product (design SERVES the ordering + admin task). Restrained color strategy.

---

## 1. Color System (OKLCH)

> The warmth lives in the **primary brown** + typography, NOT a tinted page. Body background is pure white. Do not add cream/beige to the page background "for warmth" — that is the AI cliché. Cream is reserved for the *cart sheet*, *header band*, and *status surfaces* only.

### Base surface tokens

| Token              | OKLCH                             | Hex (approx) | Use                                            |
| ------------------ | --------------------------------- | ------------ | ---------------------------------------------- |
| `--color-bg`       | `oklch(1.000 0.000 0)`            | `#ffffff`    | Page background (pure white)                   |
| `--color-surface`  | `oklch(0.985 0.010 74)`           | `#faf7f2`    | Cards, panels (warm, restrained)               |
| `--color-surface-2`| `oklch(0.962 0.018 72)`           | `#f3ece3`    | Nested fills, category chips, hover surface    |
| `--color-ink`      | `oklch(0.300 0.040 55)`           | `#3d2f26`    | Body text (≥7:1 on bg)                         |
| `--color-muted`    | `oklch(0.480 0.045 55)`           | `#6b5a4b`    | Secondary text (≥4.5:1 on bg)                  |
| `--color-border`   | `oklch(0.880 0.020 70)`           | `#e6ddd1`    | Borders, dividers, outlines                    |
| `--color-on-surface`| `oklch(0.360 0.045 58)`          | `#4a3a2d`    | Bold text on surface/card                      |

### Brand colors (strategy: Restrained)

| Token              | OKLCH                              | Use                                                      |
| ------------------ | ---------------------------------- | -------------------------------------------------------- |
| `--color-primary`  | `oklch(0.465 0.090 55)`            | **Coffee brown.** Primary buttons, active tabs, links, focus ring, current selections |
| `--color-primary-hover` | `oklch(0.420 0.090 55)`      | Primary hover/darker state                              |
| `--color-primary-fg`| `oklch(0.985 0.010 70)`           | Text on primary fills (cream-white)                     |
| `--color-on-primary-soft` | `oklch(0.420 0.080 55)`    | Icon/text on soft primary surface                       |

### Accent & category colors

Matcha green is the **accent** and the matcha-category identity. Also used sparingly for success status.

| Token              | OKLCH                               | Use                                                  |
| ------------------ | ----------------------------------- | ---------------------------------------------------- |
| `--color-accent`   | `oklch(0.600 0.120 150)`            | **Matcha green.** Matcha category chip, "in stock", success |
| `--color-accent-hover` | `oklch(0.545 0.115 150)`        | Accent hover / darker                                 |
| `--color-accent-fg`| `oklch(0.985 0.010 130)`            | Text on accent fills (near-white)                    |

### Order status semantics (the "status language" — consistent EVERYWHERE)

Color is paired with a text label + icon (color-blind safe). Never color alone.

| Status        | OKLCH                             | Filled text | Badge style (soft bg)                |
| ------------- | --------------------------------- | ----------- | ------------------------------------ |
| **Baru**      | `oklch(0.600 0.120 150)` (accent/grn) | white      | soft green bg + green-dark text      |
| **Diproses**  | `oklch(0.650 0.130 65)`           | white      | soft amber bg + amber-dark text      |
| **Siap Diambil** | `oklch(0.580 0.200 250)`       | white      | soft blue bg + blue-dark text        |
| **Selesai**   | `oklch(0.500 0.050 55)` (neutral) | white      | soft neutral bg + muted text         |

For soft badge fills use the same hue at high L (≥0.93) with text at low L (≤0.35). Badges: label + colored dot icon, never a bare color fill.

### Notes / bans
- **Never** `cream page bg` + `brown` together (AI slop). White page, brown action.
- Gradient text, glassmorphism as default, side-stripe borders: **banned**.
- Primary chroma ≤ 0.23 maintained (0.09 here — safe). White text on any saturated mid-luminance fill (brown, green, amber, blue) — the Helmholtz-Kohlrausch rule.

---

## 2. Typography

One family, tuned weights. Product UI does not need a display/body pairing.

- **Family**: `Inter` (fallback: `system-ui, -apple-system, Segoe UI, Roboto, sans-serif`). Loaded once via next/font. Applies to everything — headings, body, buttons, data.
- **Fixed rem scale** (not fluid — consistent DPI in product UI). Ratio ~1.2.

| Token                    | Size    | Weight | Line-height | Use                                        |
| ------------------------ | ------- | ------ | ----------- | ------------------------------------------ |
| `--text-display`         | 1.75rem (28px) | 700 | 1.2 | Page title (menu header)          |
| `--text-title`           | 1.25rem (20px) | 700 | 1.3 | Card titles, section headers      |
| `--text-subtitle`        | 1.0rem (16px) | 600 | 1.4 | Item names in cart, subtitles     |
| `--text-body`            | 1.0rem (16px) | 400 | 1.5 | Default body, descriptions        |
| `--text-body-sm`         | 0.875rem (14px) | 400 | 1.5 | Secondary info, cart rows, meta   |
| `--text-caption`         | 0.75rem (12px) | 500 | 1.4 | Labels, badges, timestamps, helper |
| `--text-overline`        | 0.75rem (12px) | 700 | 1.2 | Category tabs, button labels, uppercase tracked |

- Headings use `text-wrap: balance`; long prose uses `text-wrap: pretty`.
- Body line length capped at 65–75ch for descriptions.
- **No** display font in labels/buttons/data. **No** tiny-uppercase eyebrows above every section — the tracked overline is **only** for category tabs and button labels, not page sections.

---

## 3. Spacing & Layout

4px base grid.

| Token       | Value | Use                                 |
| ----------- | ----- | ----------------------------------- |
| `--space-0` | 0     |                                     |
| `--space-1` | 4px   | Tight gaps, icon spacing            |
| `--space-2` | 8px   | Small gaps                          |
| `--space-3` | 12px  | Chip/pill padding, compact gaps     |
| `--space-4` | 16px  | Default gap, card padding           |
| `--space-5` | 24px  | Section gap, card padding (large)   |
| `--space-6` | 32px  | Block spacing, sheet padding        |
| `--space-8` | 48px  | Major section rhythm                |
| `--space-12`| 64px  | Page-level rhythm                   |

**Layout rules**
- Mobile-first: max content width **480px** on the customer side (phone), centered column.
- Desktop admin: content max-width **1200px**, side nav or top nav per spec.
- Responsive grids: `repeat(auto-fit, minmax(280px, 1fr))` for menu grids; no breakpoint explosion.
- Vary spacing for rhythm — don't repeat identical gaps everywhere.

---

## 4. Border Radius & Shadows

| Token              | Value  | Use                                    |
| ------------------ | ------ | -------------------------------------- |
| `--radius-sm`      | 8px    | Inputs, small controls, badges         |
| `--radius-md`      | 12px   | Cards, buttons, menu items (ceiling)   |
| `--radius-lg`      | 16px   | Sheets, large surfaces, modals (max card) |
| `--radius-full`    | 999px  | Pills, category chips, steppers, avatars |

- **Card radius ceiling = 16px.** Never 24/32/40 on cards or sections — that's the over-rounding tell.

Shadows (semantic scale):

| Token                  | Value                                            | Use                        |
| ---------------------- | ------------------------------------------------ | -------------------------- |
| `--shadow-sm`          | `0 1px 2px rgba(61,47,38,0.06)`                  | Cards (default)            |
| `--shadow-md`          | `0 4px 10px rgba(61,47,38,0.10)`                 | Hovered cards, dropdowns   |
| `--shadow-lg`          | `0 8px 24px rgba(61,47,38,0.14)`                 | Cart sheet, modals         |

- **Never** pair `1px border` + `>=16px shadow` on the same element (ghost-card tell). Pick one: border **or** shadow ≤8px blur.
- No heavy drop shadows by default; cards use a light border + subtle shadow-sm.

---

## 5. Iconography

- **Line style** icons (heroicons outline / lucide `outline`), 1.5px stroke, consistent 20px default size.
- Same icon family across the whole product (customer + admin). Never mix families.
- Pair status **colors with icons** (e.g. a filled dot or a clock/check icon) so state is not color-only.

---

## 6. Motion & Interaction

- **150–250ms** on state transitions (hover, focus, open, close). Users in flow — no waiting on choreography.
- Ease out with exponential curves (`cubic-bezier(0.16,1,0.3,1)`). No bounce, no elastic.
- Cart sheet: slide-in from the right (desktop) / bottom sheet (mobile), 250ms ease-out. Backdrop fade 200ms.
- **`@media (prefers-reduced-motion: reduce)`**: all transitions become instant crossfades or none — mandatory on cart, modal, badge updates.
- Motion conveys **state** only (feedback, loading, reveal) — no orchestrated page-load sequences, no decorative animation.
- **Hot new order** in admin: subtle, one-time pulse on the new order row (respecting reduced motion) — not a distracting animation loop.

---

## 7. Semantic z-index scale

Use these, never `999`/`9999`.

| Token          | Value | Layer                |
| -------------- | ----- | -------------------- |
| `--z-dropdown` | 10    | dropdowns, menus     |
| `--z-sticky`   | 20    | sticky header, tabs  |
| `--z-backdrop` | 30    | modal/sheet backdrop |
| `--z-sheet`    | 40    | cart sheet, modals   |
| `--z-toast`    | 50    | toasts, tooltips     |

---

## 8. Component architecture (map)

Shared primitives (one vocabulary across customer + admin):

- **Button** — primary / secondary / ghost / danger; sizes sm / md / lg; loading, disabled states.
- **Input** — text, number stepper, search; focus ring = 2px `--color-primary`; disabled, error, loading.
- **Chip / Badge** — category chips, status badges (the status language above).
- **Card** — menu item card, order card, stat card.
- **Sheet / Modal** — cart drawer, customization modal, confirm dialogs.
- **Segmented control / Stepper** — size, sugar level, ice selection (single-pick groups) and quantity stepper.
- **Toast** — feedback for add-to-cart, checkout success, admin save actions.

Page-level surfaces are specified in `specs/ui-specs.md`:
Customer: Menu → CategoryTabs, SearchBar, MenuCard, CartDrawer, CustomizationModal, CheckoutForm, OrderReceipt, OrderTracking.
Admin: AdminLayout (login guard), Dashboard, OrderStatusBadge, OrdersInbox, MenuTable, SalesReport.

---

## 9. Responsive & breakpoints

- **Mobile-first** `< 640px`: single column menu, bottom cart button (sticky), bottom-sheet customization.
- **`sm` 640px**: menu grid 2 columns.
- **`md` 768px**: customer grid 2–3 columns; admin side nav collapses.
- **`lg` 1024px+**: desktop admin layout (side nav + content), sales report table full width.
- Customer checkout sheet can be full-width on desktop only if needed; a right drawer is preferred on md+.

---

## 10. Accessibility (baseline)

- Body text `--color-ink` ≥7:1; muted ≥4.5:1 on its background.
- Visible focus: 2px outline in `--color-primary`, at least 2px offset, on every interactive element.
- Semantic HTML: `nav`, `main`, `section`, `button`, `label`, `aside`; logical heading order h1→h2→h3.
- Form controls labeled (visible labels or aria-label with matching placeholder).
- Keyboard operable: cart, customization modal, admin table, dropdowns — full focus trap in modals/sheets, Escape closes.
- Color-blind safe: status is label + icon + color (never color alone).
- Touch targets ≥ 44px on mobile (quantity steppers, add buttons, category tabs).
