-- AlterTable
ALTER TABLE "chapter_memories" ADD COLUMN     "chapter_type" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "mood" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "novel_memories" ADD COLUMN     "used_elements" TEXT NOT NULL DEFAULT '{}';
