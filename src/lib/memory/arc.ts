import type { ChapterMemoryData, ArcMemoryData, PlotThread } from './types'

const ARC_SIZE = 10

export function computeArcMemories(
  chapterMemories: { chapterNumber: number; data: ChapterMemoryData }[],
): ArcMemoryData[] {
  const arcs: ArcMemoryData[] = []

  for (let i = 0; i < chapterMemories.length; i += ARC_SIZE) {
    const slice = chapterMemories.slice(i, i + ARC_SIZE)
    if (slice.length === 0) continue

    const allEvents = slice.flatMap(cm => cm.data.events)
    const allThreads = new Map<string, PlotThread>()

    for (const cm of slice) {
      for (const thread of cm.data.threads) {
        const existing = allThreads.get(thread.description)
        if (!existing || thread.lastSeenIn > existing.lastSeenIn) {
          allThreads.set(thread.description, thread)
        }
      }
    }

    const summaries = slice.map(cm => `第${cm.chapterNumber}章: ${cm.data.summary}`)
    const arcStart = slice[0].chapterNumber
    const arcEnd = slice[slice.length - 1].chapterNumber

    arcs.push({
      summary: `第${arcStart}-${arcEnd}章概要：\n${summaries.join('\n')}`,
      keyEvents: allEvents.slice(0, 20),
      activeThreads: Array.from(allThreads.values()).filter(t => t.status !== 'resolved'),
    })
  }

  return arcs
}

export function getArcIndex(chapterNumber: number): number {
  return Math.floor((chapterNumber - 1) / ARC_SIZE)
}
