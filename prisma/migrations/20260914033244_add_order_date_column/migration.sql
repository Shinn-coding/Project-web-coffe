/*
  Warnings:

  - You are about to alter the column `customizationOptions` on the `MenuItem` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- DropIndex
DROP INDEX "Order_orderNumber_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "orderDate" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "customizationOptions" JSONB NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MenuItem" ("available", "categoryId", "createdAt", "customizationOptions", "description", "id", "imageUrl", "name", "price", "updatedAt") SELECT "available", "categoryId", "createdAt", "customizationOptions", "description", "id", "imageUrl", "name", "price", "updatedAt" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");
CREATE INDEX "MenuItem_available_idx" ON "MenuItem"("available");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
