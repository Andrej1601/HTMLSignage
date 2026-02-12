/*
  Warnings:

  - You are about to drop the column `category` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `path` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `sizeBytes` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedAt` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `media` table. All the data in the column will be lost.
  - Added the required column `originalName` to the `media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `media` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "media_category_idx";

-- DropIndex
DROP INDEX "media_uploadedAt_idx";

-- AlterTable
ALTER TABLE "media" DROP COLUMN "category",
DROP COLUMN "duration",
DROP COLUMN "height",
DROP COLUMN "path",
DROP COLUMN "sizeBytes",
DROP COLUMN "uploadedAt",
DROP COLUMN "width",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "originalName" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "media_createdAt_idx" ON "media"("createdAt" DESC);
