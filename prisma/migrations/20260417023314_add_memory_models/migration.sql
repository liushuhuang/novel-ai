-- CreateTable
CREATE TABLE "chapter_memories" (
    "id" TEXT NOT NULL,
    "novel_id" TEXT NOT NULL,
    "chapter_number" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "characters" TEXT NOT NULL,
    "threads" TEXT NOT NULL,
    "foreshadowing" TEXT NOT NULL,
    "locations" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arc_memories" (
    "id" TEXT NOT NULL,
    "novel_id" TEXT NOT NULL,
    "arc_start" INTEGER NOT NULL,
    "arc_end" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "keyEvents" TEXT NOT NULL,
    "activeThreads" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arc_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novel_memories" (
    "id" TEXT NOT NULL,
    "novel_id" TEXT NOT NULL,
    "characters" TEXT NOT NULL,
    "worldRules" TEXT NOT NULL,
    "majorEvents" TEXT NOT NULL,
    "openThreads" TEXT NOT NULL,
    "foreshadowing" TEXT NOT NULL,
    "last_chapter_num" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novel_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chapter_memories_novel_id_chapter_number_key" ON "chapter_memories"("novel_id", "chapter_number");

-- CreateIndex
CREATE UNIQUE INDEX "arc_memories_novel_id_arc_start_key" ON "arc_memories"("novel_id", "arc_start");

-- CreateIndex
CREATE UNIQUE INDEX "novel_memories_novel_id_key" ON "novel_memories"("novel_id");

-- AddForeignKey
ALTER TABLE "chapter_memories" ADD CONSTRAINT "chapter_memories_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arc_memories" ADD CONSTRAINT "arc_memories_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_memories" ADD CONSTRAINT "novel_memories_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
