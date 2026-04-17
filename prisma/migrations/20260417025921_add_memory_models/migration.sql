/*
  Warnings:

  - Added the required column `emotions` to the `chapter_memories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `relationships` to the `chapter_memories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resources` to the `chapter_memories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "chapter_memories" ADD COLUMN     "emotions" TEXT NOT NULL,
ADD COLUMN     "relationships" TEXT NOT NULL,
ADD COLUMN     "resources" TEXT NOT NULL;
