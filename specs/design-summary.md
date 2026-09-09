# Design Summary — DS-001

Key decisions for the frontend agent. Read `DESIGN.md` (tokens) and `specs/ui-specs.md` (per-component specs) BEFORE coding.

1. **Pure-white page, brown does the warmth.** Body bg is `#fff` (`oklch(1 0 0)`), NOT cream/beige. Coffee brown (`oklch(0.465 0.09 55)`, hex ~`#7a4a2b`) is the primary for buttons/active/links; matcha green (`oklch(0.60 0.12 150)`, hex ~`#3aa76d`) is the accent + matcha-category + success. Cream is reserved for the cart sheet / header band / status surfaces only. This avoids the AI "cream page + brown" cliché.

2. **Restrained product strategy, one font (Inter), fixed rem scale.** No display/body pairing, no fluid headings. Rounded scale: card radius ≤ **16px** (`--radius-md`/`--radius-lg`), full-pill for chips/tabs/steppers. Never 24–40px on cards. Don't pair a 1px border with a ≥16px shadow (pick one).

3. **Customer path = shortest chain, mobile-first.** Category tab → menu card → customization modal (defaults pre-selected so add is always valid) → bottom cart bar → minimal checkout (name + optional table #) → order number/receipt. Every extra tap is a defect. Cart drawer (right drawer / bottom sheet), 250ms slide, `prefers-reduced-motion` honored.

4. **One "status language" everywhere.** Order status (Baru / Diproses / Siap Diambil / Selesai) uses the same pill = colored dot + label + color, on BOTH customer receipt and admin inbox. Never color alone (color-blind safe). Admin: real-time inbox with new-order pulse/toast, status-advance action per row, availability toggle, menu CRUD table with delete-confirm, sales report with date range.

5. **Every interactive component has all states**: default · hover · focus · active · disabled · loading (skeleton, not spinner) · empty (teaches, doesn't just say "nothing") · error (retry). Focus ring = 2px in primary. Touch targets ≥44px. Text ≥4.5:1 (body ≥7:1).

Verification for me (QA later): contrast, focus management, reduced-motion, responsive (phone menu + desktop admin), status language consistency, empty/error/loading on all data sections.
