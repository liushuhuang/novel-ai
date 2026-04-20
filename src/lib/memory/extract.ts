import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { createAIProvider } from '@/lib/ai/factory'
import { extractChapterMemory } from './chapter'
import { computeArcMemories } from './arc'
import { computeNovelMemory } from './novel'
import type { ChapterMemoryData, ArcMemoryData, NovelMemoryData } from './types'

const ARC_SIZE = 10

export async function runMemoryExtraction(
  novelId: string,
  chapterNumber: number,
): Promise<void> {
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    include: { provider: true },
  })
  if (!novel) return

  let apiKey: string
  try {
    apiKey = decrypt(novel.provider.apiKey)
  } catch {
    console.error('Memory extraction: failed to decrypt API key')
    return
  }

  const aiProvider = createAIProvider({
    baseUrl: novel.provider.baseUrl,
    apiKey,
    model: novel.provider.model,
    type: novel.provider.type,
  })

  // Phase 1: Extract chapter memory (Observer-style)
  const chapter = await prisma.chapter.findUnique({
    where: { novelId_number: { novelId, number: chapterNumber } },
  })
  if (!chapter) return

  let chapterMemoryData: ChapterMemoryData
  try {
    chapterMemoryData = await extractChapterMemory(aiProvider, chapterNumber, chapter.content)
  } catch (e) {
    console.error(`Memory extraction failed for chapter ${chapterNumber}:`, e)
    return
  }

  await prisma.chapterMemory.upsert({
    where: { novelId_chapterNumber: { novelId, chapterNumber } },
    create: {
      novelId,
      chapterNumber,
      summary: chapterMemoryData.summary,
      characters: JSON.stringify(chapterMemoryData.characters),
      threads: JSON.stringify(chapterMemoryData.threads),
      foreshadowing: JSON.stringify(chapterMemoryData.foreshadowing),
      locations: JSON.stringify(chapterMemoryData.locations),
      events: JSON.stringify(chapterMemoryData.events),
      emotions: JSON.stringify(chapterMemoryData.emotions),
      resources: JSON.stringify(chapterMemoryData.resources),
      relationships: JSON.stringify(chapterMemoryData.relationships),
      resolvedForeshadowing: JSON.stringify(chapterMemoryData.resolvedForeshadowing),
      chapterType: chapterMemoryData.chapterType ?? '',
      mood: chapterMemoryData.mood ?? '',
    },
    update: {
      summary: chapterMemoryData.summary,
      characters: JSON.stringify(chapterMemoryData.characters),
      threads: JSON.stringify(chapterMemoryData.threads),
      foreshadowing: JSON.stringify(chapterMemoryData.foreshadowing),
      locations: JSON.stringify(chapterMemoryData.locations),
      events: JSON.stringify(chapterMemoryData.events),
      emotions: JSON.stringify(chapterMemoryData.emotions),
      resources: JSON.stringify(chapterMemoryData.resources),
      relationships: JSON.stringify(chapterMemoryData.relationships),
      resolvedForeshadowing: JSON.stringify(chapterMemoryData.resolvedForeshadowing),
      chapterType: chapterMemoryData.chapterType ?? '',
      mood: chapterMemoryData.mood ?? '',
    },
  })

  // Phase 2: Recompute arc + novel memory (deterministic)
  const allChapterMemories = await prisma.chapterMemory.findMany({
    where: { novelId },
    orderBy: { chapterNumber: 'asc' },
  })

  const parsedChapterMemories = allChapterMemories.map(cm => ({
    chapterNumber: cm.chapterNumber,
    data: parseChapterMemoryJson(cm),
  }))

  const isArcBoundary = chapterNumber % ARC_SIZE === 0
  const isPeriodic = chapterNumber % 5 === 0

  if (isArcBoundary || isPeriodic) {
    const arcs = computeArcMemories(parsedChapterMemories)
    for (let i = 0; i < arcs.length; i++) {
      const arcStart = i * ARC_SIZE + 1
      await prisma.arcMemory.upsert({
        where: { novelId_arcStart: { novelId, arcStart } },
        create: {
          novelId,
          arcStart,
          arcEnd: arcStart + ARC_SIZE - 1,
          summary: arcs[i].summary,
          keyEvents: JSON.stringify(arcs[i].keyEvents),
          activeThreads: JSON.stringify(arcs[i].activeThreads),
        },
        update: {
          summary: arcs[i].summary,
          keyEvents: JSON.stringify(arcs[i].keyEvents),
          activeThreads: JSON.stringify(arcs[i].activeThreads),
        },
      })
    }

    // Recompute novel memory
    const arcMemories = await prisma.arcMemory.findMany({
      where: { novelId },
      orderBy: { arcStart: 'asc' },
    })
    const parsedArcs: ArcMemoryData[] = arcMemories.map(a => ({
      summary: a.summary,
      keyEvents: JSON.parse(a.keyEvents),
      activeThreads: JSON.parse(a.activeThreads),
    }))

    const existingNovelMemory = await prisma.novelMemory.findUnique({
      where: { novelId },
    })
    let existingParsed: NovelMemoryData | null = null
    if (existingNovelMemory) {
      existingParsed = {
        characters: JSON.parse(existingNovelMemory.characters),
        worldRules: JSON.parse(existingNovelMemory.worldRules),
        majorEvents: JSON.parse(existingNovelMemory.majorEvents),
        openThreads: JSON.parse(existingNovelMemory.openThreads),
        foreshadowing: JSON.parse(existingNovelMemory.foreshadowing),
        lastChapterNum: existingNovelMemory.lastChapterNum,
      }
    }

    const novelMemory = computeNovelMemory(parsedChapterMemories, parsedArcs, existingParsed)

    await prisma.novelMemory.upsert({
      where: { novelId },
      create: {
        novelId,
        characters: JSON.stringify(novelMemory.characters),
        worldRules: JSON.stringify(novelMemory.worldRules),
        majorEvents: JSON.stringify(novelMemory.majorEvents),
        openThreads: JSON.stringify(novelMemory.openThreads),
        foreshadowing: JSON.stringify(novelMemory.foreshadowing),
        lastChapterNum: novelMemory.lastChapterNum,
      },
      update: {
        characters: JSON.stringify(novelMemory.characters),
        worldRules: JSON.stringify(novelMemory.worldRules),
        majorEvents: JSON.stringify(novelMemory.majorEvents),
        openThreads: JSON.stringify(novelMemory.openThreads),
        foreshadowing: JSON.stringify(novelMemory.foreshadowing),
        lastChapterNum: novelMemory.lastChapterNum,
      },
    })
  }
}

function parseChapterMemoryJson(cm: {
  summary: string
  characters: string
  threads: string
  foreshadowing: string
  locations: string
  events: string
  emotions: string
  resources: string
  relationships: string
  resolvedForeshadowing: string
  chapterType: string
  mood: string
}): ChapterMemoryData {
  return {
    summary: cm.summary,
    characters: JSON.parse(cm.characters),
    threads: JSON.parse(cm.threads),
    foreshadowing: JSON.parse(cm.foreshadowing),
    locations: JSON.parse(cm.locations),
    events: JSON.parse(cm.events),
    emotions: JSON.parse(cm.emotions),
    resources: JSON.parse(cm.resources),
    relationships: JSON.parse(cm.relationships),
    resolvedForeshadowing: JSON.parse(cm.resolvedForeshadowing || '[]'),
    chapterType: cm.chapterType || '',
    mood: cm.mood || '',
  }
}
