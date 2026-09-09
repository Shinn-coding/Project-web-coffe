# DB Schema Summary — Coffee Shop Ordering System

## Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| **Category** | Menu grouping (Coffee, Non-Coffee, Pastry...) | `name` (unique), `description` |
| **MenuItem** | Individual menu item | `name`, `price` (Int, Rupiah), `available`, `customizationOptions` (JSON string), FK → Category |
| **Order** | Customer order | `orderNumber` (unique display ID), `customerName`, `tableNumber`, `status` (enum), `totalPrice` |
| **OrderItem** | Line item in an order | `itemName` (snapshot), `unitPrice` (snapshot), `quantity`, `subtotal`, `customization` (JSON string), FK → Order + MenuItem |
| **AdminUser** | Staff authentication | `username` (unique), `passwordHash`, `name`, `role` (admin/kasir) |

## Relations

```
Category  1──N  MenuItem
MenuItem  1──N  OrderItem
Order     1──N  OrderItem
MenuItem  N──1  OrderItem (via menuItemId)
Order     N──1  OrderItem (via orderId)
```

All FKs cascade on delete (Category → MenuItem → OrderItem chain).

## Enums

- **OrderStatus**: `baru` → `diproses` → `siap_diambil` → `selesai`
- **Role**: `admin` | `kasir`

## Indexes

| Table | Columns | Type | Rationale |
|-------|---------|------|-----------|
| MenuItem | `categoryId` | Single | JOIN filter |
| MenuItem | `available` | Single | Filter in-stock items |
| Order | `status` | Single | Filter by order state |
| Order | `createdAt` | Single | Date range queries |
| Order | `status, createdAt` | Composite | "Today's pending orders" |
| OrderItem | `orderId` | Single | Get items for an order |
| OrderItem | `menuItemId` | Single | Sales per item |

## Design Decisions

1. **Money as Integer (Rupiah)**: Store Rp 25.000 as `25000`. No floating point issues, no Decimal complexity. SQLite INTEGER handles this natively.

2. **Categories as separate table**: More flexible than enum. Adding "Matcha" or "Frappé" later = one INSERT, not a migration.

3. **Customization as JSON string**: SQLite has no native JSON type. Store as `TEXT`, parse with `JSON.parse()` in app code. Simple, works.

4. **Order snapshots**: `OrderItem.itemName` and `OrderItem.unitPrice` are copied from MenuItem at order time. Historical orders remain correct even if menu prices change.

5. **Auto-increment IDs**: No UUID. Single-shop system, auto-increment is simpler and faster.

6. **No customer table**: Guest checkout only. `customerName` and `tableNumber` are optional strings on Order.

7. **Soft deletes omitted**: YAGNI. Add `deletedAt` column later if needed.
