/*
  Warnings:

  - You are about to drop the column `expectedTool` on the `Payload` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Payload" DROP COLUMN "expectedTool",
ADD COLUMN     "expectedTools" TEXT[];
