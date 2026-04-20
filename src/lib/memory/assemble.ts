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
    .map(f => {
      const age = chapterNumber - f.chapterIntroduced
      let score = scoreByRecency(chapterNumber, f.chapterIntroduced)
      if (!f.resolved) {
        score += Math.min(age, 10) * 2
      } else {
        score += 2
      }
      return { f, score }
    })
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
  let recentlyResolved = ''
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
    const unresolvedLines: string[] = []
    const resolvedLines: string[] = []
    for (const f of topForeshadowing) {
      if (f.resolved) {
        resolvedLines.push(`- ${f.hint}（第${f.chapterIntroduced}章埋下，${f.resolution}）`)
      } else {
        const age = chapterNumber - f.chapterIntroduced
        const urgency = age > 10 ? '【请优先处理】' : ''
        unresolvedLines.push(`- ${f.hint}（第${f.chapterIntroduced}章埋下，已过${age}章）${urgency}`)
      }
    }
    foreshadowing = unresolvedLines.join('\n')
    recentlyResolved = resolvedLines.join('\n')

    const allText = [characters, openThreads, foreshadowing, recentlyResolved].join('\n')
    if (estimateTokens(allText) > MEMORY_BUDGET_TOKENS) {
      const ratio = MEMORY_BUDGET_TOKENS / estimateTokens(allText)
      const maxChars = Math.floor(allText.length * ratio * 0.8)
      characters = characters.slice(0, Math.floor(maxChars * 0.45))
      openThreads = openThreads.slice(0, Math.floor(maxChars * 0.3))
      foreshadowing = foreshadowing.slice(0, Math.floor(maxChars * 0.15))
      recentlyResolved = recentlyResolved.slice(0, Math.floor(maxChars * 0.1))
    }
  }

  const arcIndex = Math.floor((chapterNumber - 1) / 10)
  if (arcIndex < arcMemories.length && arcMemories[arcIndex]) {
    arcSummary = arcMemories[arcIndex].summary
  }

  // 生成叙事锚点：上一章结尾段落
  let narrativeAnchor: string | undefined
  if (recentChapterContents && recentChapterContents.size > 0) {
    const lastChapterContent = recentChapterContents.get(chapterNumber - 1)
    if (lastChapterContent) {
      const lastPara = extractLastParagraph(lastChapterContent)
      if (lastPara) {
        narrativeAnchor = `上一章（第${chapterNumber - 1}章）结尾场景：${lastPara}`
      }
    }
  }

  return {
    previousChapterSummary,
    recentEndings,
    arcSummary,
    characters,
    openThreads,
    foreshadowing,
    recentlyResolved,
    relationships,
    narrativeAnchor,
  }
}

function extractLastParagraph(content: string): string {
  const paragraphs = content.split('\n').map(l => l.trim()).filter(l => l.length > 10)
  const last = paragraphs[paragraphs.length - 1] ?? ''
  return last.length > 80 ? last.slice(0, 77) + '...' : last
}
