import { prisma } from '@/lib/db'
import { assembleMemoryContext } from '@/lib/memory/assemble'
import type { ChapterMemoryData, ArcMemoryData } from '@/lib/memory/types'

export interface ToolExecutionContext {
  novelId: string
  chapterNumber: number
}

/** 执行 agent 工具调用 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<string> {
  switch (name) {
    case 'read_memory':
      return handleReadMemory(context, args.include_chapter_history as boolean)
    case 'read_chapter':
      return handleReadChapter(context, args.chapter_number as number)
    case 'get_writing_progress':
      return handleGetWritingProgress(context)
    case 'write_chapter':
      return handleWriteChapter(args.content as string)
    default:
      return `错误：未知工具 "${name}"`
  }
}

async function handleReadMemory(
  context: ToolExecutionContext,
  includeChapterHistory?: boolean,
): Promise<string> {
  const { novelId, chapterNumber } = context

  const [chapterMems, arcMems, novelMem, recentChapters] =
    await Promise.all([
      prisma.chapterMemory.findMany({
        where: { novelId },
        orderBy: { chapterNumber: 'asc' },
      }),
      prisma.arcMemory.findMany({
        where: { novelId },
        orderBy: { arcStart: 'asc' },
      }),
      prisma.novelMemory.findUnique({ where: { novelId } }),
      includeChapterHistory
        ? prisma.chapter.findMany({
            where: {
              novelId,
              number: { gte: chapterNumber - 3, lt: chapterNumber },
            },
            select: { number: true, content: true },
          })
        : Promise.resolve([]),
    ])

  const chapterMemoryMap = new Map<number, ChapterMemoryData>()
  for (const cm of chapterMems) {
    try {
      chapterMemoryMap.set(cm.chapterNumber, {
        summary: cm.summary,
        characters: JSON.parse(cm.characters || '[]'),
        threads: JSON.parse(cm.threads || '[]'),
        foreshadowing: JSON.parse(cm.foreshadowing || '[]'),
        locations: JSON.parse(cm.locations || '[]'),
        events: JSON.parse(cm.events || '[]'),
        emotions: JSON.parse(cm.emotions || '[]'),
        resources: JSON.parse(cm.resources || '[]'),
        relationships: JSON.parse(cm.relationships || '[]'),
        resolvedForeshadowing: JSON.parse(
          cm.resolvedForeshadowing || '[]',
        ),
        chapterType: cm.chapterType || '',
        mood: cm.mood || '',
      })
    } catch {
      // Skip malformed records
    }
  }

  const arcMemories: ArcMemoryData[] = arcMems.map(a => ({
    summary: a.summary,
    keyEvents: JSON.parse(a.keyEvents || '[]'),
    activeThreads: JSON.parse(a.activeThreads || '[]'),
  }))

  const novelMemoryData = novelMem
    ? {
        characters: JSON.parse(novelMem.characters || '[]'),
        worldRules: JSON.parse(novelMem.worldRules || '[]'),
        majorEvents: JSON.parse(novelMem.majorEvents || '[]'),
        openThreads: JSON.parse(novelMem.openThreads || '[]'),
        foreshadowing: JSON.parse(novelMem.foreshadowing || '[]'),
        lastChapterNum: novelMem.lastChapterNum,
      }
    : null

  const recentChapterContents = new Map<number, string>()
  for (const ch of recentChapters) {
    recentChapterContents.set(ch.number, ch.content)
  }

  const memoryContext = assembleMemoryContext(
    chapterNumber,
    chapterMemoryMap,
    arcMemories,
    novelMemoryData,
    includeChapterHistory ? recentChapterContents : undefined,
  )

  // Format as readable text
  const parts: string[] = []

  if (memoryContext.narrativeAnchor) {
    parts.push(`### 叙事衔接（上一章结尾）\n${memoryContext.narrativeAnchor}`)
    parts.push('请从上述场景自然衔接，不要出现时间线断裂或场景跳跃。')
  }
  if (memoryContext.previousChapterSummary) {
    parts.push(`### 上一章概要\n${memoryContext.previousChapterSummary}`)
  }
  if (memoryContext.previousChapterEvents) {
    parts.push(`### 上一章关键事件\n${memoryContext.previousChapterEvents}`)
  }
  if (memoryContext.characters) {
    parts.push(`### 角色状态\n${memoryContext.characters}`)
  }
  if (memoryContext.openThreads) {
    parts.push(`### 未完结剧情线\n${memoryContext.openThreads}`)
  }
  if (memoryContext.foreshadowing) {
    parts.push(`### 伏笔池\n${memoryContext.foreshadowing}`)
  }
  if (memoryContext.arcSummary) {
    parts.push(`### 当前篇章概要\n${memoryContext.arcSummary}`)
  }

  if (parts.length === 0) {
    return '暂无记忆数据。'
  }

  return parts.join('\n\n')
}

async function handleReadChapter(
  context: ToolExecutionContext,
  chapterNumber: number,
): Promise<string> {
  if (!chapterNumber || typeof chapterNumber !== 'number') {
    return '错误：chapter_number 必须是有效的数字'
  }

  const chapter = await prisma.chapter.findUnique({
    where: {
      novelId_number: { novelId: context.novelId, number: chapterNumber },
    },
  })

  if (!chapter) {
    return `第${chapterNumber}章不存在。`
  }

  return `第${chapter.number}章：${chapter.title}\n\n${chapter.content}`
}

async function handleGetWritingProgress(
  context: ToolExecutionContext,
): Promise<string> {
  const { novelId } = context

  const chapters = await prisma.chapter.findMany({
    where: { novelId },
    orderBy: { number: 'asc' },
    select: { number: true, title: true, wordCount: true },
  })

  const chapterMemories = await prisma.chapterMemory.findMany({
    where: { novelId },
    orderBy: { chapterNumber: 'asc' },
    select: { chapterNumber: true, summary: true },
  })

  if (chapters.length === 0) {
    return '还没有任何章节。'
  }

  const lines: string[] = [
    `总章节数：${chapters.length}`,
    `最新章节：第${chapters[chapters.length - 1].number}章`,
    '',
    '章节列表：',
  ]

  for (const ch of chapters) {
    const mem = chapterMemories.find(cm => cm.chapterNumber === ch.number)
    const summary = mem ? ` - ${mem.summary}` : ''
    lines.push(
      `第${ch.number}章：${ch.title}（${ch.wordCount}字）${summary}`,
    )
  }

  return lines.join('\n')
}

function handleWriteChapter(content: string): string {
  if (!content || typeof content !== 'string') {
    return '错误：content 必须是有效的字符串'
  }

  const trimmed = content.trim()
  if (!trimmed) {
    return '错误：content 不能为空'
  }

  // 验证格式
  const titleMatch = trimmed.match(/^第\d+章[：:]/)
  if (!titleMatch) {
    return '错误：章节内容必须以"第X章：标题"格式开头'
  }

  // 返回成功标记（实际保存由 loop 层处理）
  return `章节内容已接收，共${trimmed.length}字。请等待保存。`
}
