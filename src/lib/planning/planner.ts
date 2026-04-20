import { prisma } from '@/lib/db'
import type { ChapterIntent } from './types'
import { analyzeCadence } from './cadence'
import type { MemoryContext } from '@/lib/memory/types'

/**
 * 生成章节意图（纯规则，不调 LLM）
 * 借鉴 InkOS PlannerAgent: 从记忆上下文 + 历史摘要推导出本章应该写什么、避免什么
 */
export async function planChapter(
  novelId: string,
  chapterNumber: number,
  memoryContext?: MemoryContext,
): Promise<ChapterIntent> {
  // 1. 获取最近 4 章的摘要用于节奏分析
  const recentMemories = await prisma.chapterMemory.findMany({
    where: {
      novelId,
      chapterNumber: { gte: chapterNumber - 4, lt: chapterNumber },
    },
    orderBy: { chapterNumber: 'asc' },
    select: {
      chapterNumber: true,
      summary: true,
      events: true,
      locations: true,
    },
  })

  // 2. 节奏分析（纯规则）
  const cadence = analyzeCadence(recentMemories)

  // 3. 推导 goal
  const goal = deriveGoal(chapterNumber, memoryContext)

  // 4. 生成 mustAvoid 列表
  const mustAvoid = buildMustAvoid(cadence, recentMemories)

  // 5. 生成 mustKeep 列表
  const mustKeep = buildMustKeep(memoryContext)

  // 6. 伏笔议程
  const hookAgenda = buildHookAgenda(chapterNumber, memoryContext)

  // 7. 场景/情绪指令
  const sceneDirective =
    cadence.scenePressure === 'high'
      ? `最近${cadence.sceneStreak}章都是"${cadence.recentSceneTypes[cadence.recentSceneTypes.length - 1]}"类型，请更换场景类型`
      : undefined

  const moodDirective =
    cadence.moodPressure === 'high'
      ? `最近${cadence.moodStreak}章都是高张力情绪，请安排降调/喘息场景`
      : undefined

  return {
    chapter: chapterNumber,
    goal,
    sceneDirective,
    moodDirective,
    mustKeep,
    mustAvoid,
    hookAgenda,
  }
}

function deriveGoal(chapterNumber: number, memoryContext?: MemoryContext): string {
  if (!memoryContext) return '建立世界观，引入主角和核心冲突'

  // 从 openThreads 推导
  if (memoryContext.openThreads) {
    const threads = memoryContext.openThreads
      .split('\n')
      .filter(l => l.trim().startsWith('-'))
    if (threads.length > 0) {
      return `推进主线：${threads[0].trim().slice(0, 60)}`
    }
  }

  return '延续上一章剧情，推进核心冲突'
}

function buildMustAvoid(
  cadence: ReturnType<typeof analyzeCadence>,
  recentMemories: Array<{ locations: string }>,
): string[] {
  const avoid: string[] = []

  // 场景重复
  if (cadence.scenePressure === 'high') {
    const repeatedType =
      cadence.recentSceneTypes[cadence.recentSceneTypes.length - 1]
    avoid.push(
      `禁止使用"${repeatedType}"场景类型（最近${cadence.sceneStreak}章已连续使用）`,
    )
  }

  // 情绪单调
  if (cadence.moodPressure === 'high') {
    avoid.push('禁止继续高张力情绪，需要降调')
  }

  // 检查重复出现的地点
  const allLocations = recentMemories.flatMap(m => {
    try {
      return JSON.parse(m.locations || '[]')
    } catch {
      return []
    }
  })
  const locationCounts = new Map<string, number>()
  for (const loc of allLocations) {
    locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1)
  }
  for (const [loc, count] of locationCounts) {
    if (count >= 3) {
      avoid.push(`地点"${loc}"已连续出现${count}次，建议换场景`)
    }
  }

  // 检测重复描写
  for (const pattern of cadence.repeatedPatterns) {
    avoid.push(`避免重复描写模式：${pattern}`)
  }

  return avoid
}

function buildMustKeep(memoryContext?: MemoryContext): string[] {
  if (!memoryContext) return []
  const keep: string[] = []

  // 从角色状态中提取关键约束
  if (memoryContext.characters) {
    const chars = memoryContext.characters
      .split('\n')
      .filter(l => l.trim())
      .slice(0, 5)
    keep.push(...chars.map(c => c.trim()))
  }

  return keep.slice(0, 4)
}

function buildHookAgenda(
  chapterNumber: number,
  memoryContext?: MemoryContext,
): ChapterIntent['hookAgenda'] {
  const agenda: ChapterIntent['hookAgenda'] = {
    mustAdvance: [],
    shouldResolve: [],
    staleDebt: [],
  }

  if (!memoryContext?.foreshadowing) return agenda

  const lines = memoryContext.foreshadowing
    .split('\n')
    .filter(l => l.startsWith('-'))

  for (const line of lines) {
    if (line.includes('【请优先处理】')) {
      agenda.staleDebt.push(line.trim())
    }
  }

  // 取最近 3 个未回收伏笔作为 mustAdvance
  agenda.mustAdvance = lines
    .filter(l => !l.includes('已回收') && !l.includes('已解决'))
    .slice(0, 3)
    .map(l => l.trim())

  return agenda
}
