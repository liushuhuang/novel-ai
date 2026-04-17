import type { MemoryContext, NovelMemoryData, ArcMemoryData, ChapterMemoryData, PlotThread, ForeshadowingItem } from './types'

function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars * 2 + otherChars * 0.5)
}

const MEMORY_BUDGET_TOKENS = 3000

function scoreByRecency(chapterNumber: number, lastSeenIn: number): number {
  const age = Math.max(0, chapterNumber - lastSeenIn)
  return Math.max(0, 12 - age)
}

function selectTopThreads(
  threads: PlotThread[],
  chapterNumber: number,
  limit: number,
): PlotThread[] {
  return threads
    .map(t => ({ t, score: scoreByRecency(chapterNumber, t.lastSeenIn) + (t.status === 'open' ? 5 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(e => e.t)
}

function selectTopForeshadowing(
  items: ForeshadowingItem[],
  chapterNumber: number,
  limit: number,
): ForeshadowingItem[] {
  return items
    .map(f => ({ f, score: scoreByRecency(chapterNumber, f.chapterIntroduced) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(e => e.f)
}

export function assembleMemoryContext(
  chapterNumber: number,
  chapterMemories: Map<number, ChapterMemoryData>,
  arcMemories: ArcMemoryData[],
  novelMemory: NovelMemoryData | null,
  recentChapterContents?: Map<number, string>,
): MemoryContext {
  const prevMemory = chapterMemories.get(chapterNumber - 1)
  const previousChapterSummary = prevMemory?.summary ?? ''

  let recentEndings = ''
  if (recentChapterContents && recentChapterContents.size > 0) {
    const endings: string[] = []
    for (let i = 1; i <= 3; i++) {
      const content = recentChapterContents.get(chapterNumber - i)
      if (content) {
        const lastPara = extractLastParagraph(content)
        if (lastPara) endings.push(`第${chapterNumber - i}章结尾：${lastPara}`)
      }
    }
    recentEndings = endings.reverse().join('\n')
  }

  let characters = ''
  let openThreads = ''
  let foreshadowing = ''
  let relationships = ''
  let arcSummary = ''

  if (novelMemory) {
    const sortedChars = novelMemory.characters
      .sort((a, b) => b.lastSeenIn - a.lastSeenIn)
      .slice(0, 30)
    characters = sortedChars.map(c =>
      `- ${c.name}（${c.role}）：${c.currentState}`
    ).join('\n')

    const topThreads = selectTopThreads(novelMemory.openThreads, chapterNumber, 10)
    openThreads = topThreads.map(t =>
      `- ${t.description}（${t.status}，第${t.introducedIn}章引入，最近出现第${t.lastSeenIn}章）`
    ).join('\n')

    const topForeshadowing = selectTopForeshadowing(novelMemory.foreshadowing, chapterNumber, 8)
    foreshadowing = topForeshadowing.map(f =>
      `- ${f.hint}（第${f.chapterIntroduced}章埋下）`
    ).join('\n')

    const allText = [characters, openThreads, foreshadowing].join('\n')
    if (estimateTokens(allText) > MEMORY_BUDGET_TOKENS) {
      const ratio = MEMORY_BUDGET_TOKENS / estimateTokens(allText)
      const maxChars = Math.floor(allText.length * ratio * 0.8)
      characters = characters.slice(0, Math.floor(maxChars * 0.45))
      openThreads = openThreads.slice(0, Math.floor(maxChars * 0.35))
      foreshadowing = foreshadowing.slice(0, Math.floor(maxChars * 0.2))
    }
  }

  const arcIndex = Math.floor((chapterNumber - 1) / 10)
  if (arcIndex < arcMemories.length && arcMemories[arcIndex]) {
    arcSummary = arcMemories[arcIndex].summary
  }

  return {
    previousChapterSummary,
    recentEndings,
    arcSummary,
    characters,
    openThreads,
    foreshadowing,
    relationships,
  }
}

function extractLastParagraph(content: string): string {
  const paragraphs = content.split('\n').map(l => l.trim()).filter(l => l.length > 10)
  const last = paragraphs[paragraphs.length - 1] ?? ''
  return last.length > 80 ? last.slice(0, 77) + '...' : last
}
