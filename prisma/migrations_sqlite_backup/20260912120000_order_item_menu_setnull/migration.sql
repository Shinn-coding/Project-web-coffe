/*
  Warnings:

  - The column `customization` on the `OrderItem` table was changed from `TEXT` to `JSONB`.
    This aligns the table with the Prisma schema's `Json` type (pre-existing drift);
    SQLite does not enforce the declared type, existing rows are preserved.

  - Made the column `menuItemId` on the `OrderItem` table nullable. The foreign key
    `OrderItem_menuItemId_fkey` now uses `ON DELETE SET NULL` so deleting a MenuItem
    keeps historical OrderItems (snapshotted name/price/customization) intact.
*/

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemName" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "customization" JSONB NOT NULL,
    "orderId" INTEGER NOT NULL,
    "menuItemId" INTEGER,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OrderItem" ("customization", "id", "itemName", "menuItemId", "orderId", "quantity", "subtotal", "unitPrice") SELECT "customization", "id", "itemName", "menuItemId", "orderId", "quantity", "subtotal", "unitPrice" FROM "OrderItem";
DROP TABLE "OrderItem";
ALTER TABLE "new_OrderItem" RENAME TO "OrderItem";
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
