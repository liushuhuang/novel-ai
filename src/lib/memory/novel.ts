import type {
  ChapterMemoryData,
  ArcMemoryData,
  NovelMemoryData,
  CharacterInfo,
  PlotThread,
  ForeshadowingItem,
} from './types'

export function computeNovelMemory(
  chapterMemories: { chapterNumber: number; data: ChapterMemoryData }[],
  arcMemories: ArcMemoryData[],
  existingMemory: NovelMemoryData | null,
): NovelMemoryData {
  const charMap = new Map<string, CharacterInfo>()
  if (existingMemory) {
    for (const c of existingMemory.characters) {
      charMap.set(c.name, c)
    }
  }

  for (const cm of chapterMemories) {
    for (const name of cm.data.characters) {
      const existing = charMap.get(name)
      if (!existing) {
        charMap.set(name, {
          name,
          role: 'unknown',
          traits: [],
          currentState: `首次出现于第${cm.chapterNumber}章`,
          lastSeenIn: cm.chapterNumber,
        })
      } else {
        charMap.set(name, { ...existing, lastSeenIn: cm.chapterNumber })
      }
    }
  }

  const threadMap = new Map<string, PlotThread>()
  if (existingMemory) {
    for (const t of existingMemory.openThreads) {
      threadMap.set(t.description, t)
    }
  }
  for (const cm of chapterMemories) {
    for (const t of cm.data.threads) {
      const existing = threadMap.get(t.description)
      if (!existing || t.lastSeenIn > existing.lastSeenIn) {
        threadMap.set(t.description, t)
      }
    }
  }

  const foreshadowingList: ForeshadowingItem[] = existingMemory?.foreshadowing ?? []
  const existingHints = new Set(foreshadowingList.map(f => f.hint))
  for (const cm of chapterMemories) {
    for (const hint of cm.data.foreshadowing) {
      if (!existingHints.has(hint)) {
        foreshadowingList.push({
          hint,
          chapterIntroduced: cm.chapterNumber,
          resolved: false,
        })
        existingHints.add(hint)
      }
    }
  }

  // Mark resolved foreshadowing
  const resolvedHints = new Set<string>()
  for (const cm of chapterMemories) {
    for (const hint of cm.data.resolvedForeshadowing) {
      resolvedHints.add(hint)
    }
  }
  for (const f of foreshadowingList) {
    if (resolvedHints.has(f.hint) && !f.resolved) {
      f.resolved = true
      for (const cm of chapterMemories) {
        if (cm.data.resolvedForeshadowing.includes(f.hint)) {
          f.resolution = `第${cm.chapterNumber}章回收`
          break
        }
      }
    }
  }

  const worldRules = existingMemory?.worldRules ?? []
  const majorEvents = arcMemories.flatMap(a => a.keyEvents).slice(0, 50)
  const lastChapterNum = chapterMemories.length > 0
    ? chapterMemories[chapterMemories.length - 1].chapterNumber
    : existingMemory?.lastChapterNum ?? 0

  return {
    characters: Array.from(charMap.values()),
    worldRules,
    majorEvents,
    openThreads: Array.from(threadMap.values()).filter(t => t.status !== 'resolved'),
    foreshadowing: foreshadowingList.filter(f => {
      if (!f.resolved) return true
      if (f.resolution) {
        const resolvedChapter = parseInt(f.resolution.match(/第(\d+)章/)?.[1] ?? '0')
        return resolvedChapter >= lastChapterNum - 2
      }
      return false
    }),
    lastChapterNum,
  }
}
