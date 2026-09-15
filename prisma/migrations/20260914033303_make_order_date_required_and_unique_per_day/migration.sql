/*
  Warnings:

  - Made the column `orderDate` on table `Order` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNumber" TEXT NOT NULL,
    "orderDate" TEXT NOT NULL,
    "orderToken" TEXT NOT NULL,
    "customerName" TEXT,
    "tableNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'baru',
    "totalPrice" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Order" ("createdAt", "customerName", "id", "orderDate", "orderNumber", "orderToken", "status", "tableNumber", "totalPrice", "updatedAt") SELECT "createdAt", "customerName", "id", "orderDate", "orderNumber", "orderToken", "status", "tableNumber", "totalPrice", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderToken_key" ON "Order"("orderToken");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE UNIQUE INDEX "Order_orderDate_orderNumber_key" ON "Order"("orderDate", "orderNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
