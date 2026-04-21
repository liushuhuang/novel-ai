import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { createAIProvider } from '@/lib/ai/factory'
import { getSystemPrompt } from '@/lib/prompts/system'
import { getChapterPrompt } from '@/lib/prompts/chapter'
import { assembleMemoryContext } from '@/lib/memory/assemble'
import { planChapter } from '@/lib/planning/planner'
import { runPipeline } from '@/lib/pipeline/runner'
import type { PipelineContext } from '@/lib/pipeline/types'
import type { ChatMessage, AIProvider } from '@/types/ai'
import type { MemoryContext, ChapterMemoryData, ArcMemoryData } from '@/lib/memory/types'
import type { ChapterIntent } from '@/lib/planning/types'

export interface NovelConfig {
  genre: string
  target: string
  wordCount: string
  style: string
  pov: string
  background: string
  backgroundCustom?: string
  protagonist?: string
  conflict?: string
  customNote?: string
}

export interface LoadedContext {
  config: NovelConfig
  provider: AIProvider
  memoryContext: MemoryContext | undefined
  chapterIntent: ChapterIntent | undefined
}

/** 加载小说配置 + AI 供应商 */
export async function loadNovelConfig(
  novelId: string,
): Promise<{ config: NovelConfig; provider: AIProvider }> {
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    include: { provider: true },
  })
  if (!novel) throw new Error('Novel not found')

  const config: NovelConfig = {
    genre: novel.genre,
    target: novel.target,
    wordCount: novel.wordCount,
    style: novel.style,
    pov: novel.pov,
    background: novel.background,
    protagonist: novel.protagonist ?? undefined,
    conflict: novel.conflict ?? undefined,
    customNote: novel.customNote ?? undefined,
  }

  let apiKey: string
  try {
    apiKey = decrypt(novel.provider.apiKey)
  } catch {
    throw new Error('Failed to decrypt API key')
  }

  const provider = createAIProvider({
    baseUrl: novel.provider.baseUrl,
    apiKey,
    model: novel.provider.model,
    type: novel.provider.type,
  })

  return { config, provider }
}

/** 加载记忆上下文 */
export async function loadMemoryContext(
  novelId: string,
  chapterNumber: number,
): Promise<MemoryContext | undefined> {
  if (chapterNumber <= 1) return undefined

  const [chapterMems, arcMems, novelMem, recentChapters] = await Promise.all([
    prisma.chapterMemory.findMany({
      where: { novelId },
      orderBy: { chapterNumber: 'asc' },
    }),
    prisma.arcMemory.findMany({
      where: { novelId },
      orderBy: { arcStart: 'asc' },
    }),
    prisma.novelMemory.findUnique({
      where: { novelId },
    }),
    prisma.chapter.findMany({
      where: { novelId, number: { gte: chapterNumber - 3, lt: chapterNumber } },
      select: { number: true, content: true },
    }),
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
        resolvedForeshadowing: JSON.parse(cm.resolvedForeshadowing || '[]'),
      })
    } catch {
      // Skip malformed memory records
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

  return assembleMemoryContext(
    chapterNumber,
    chapterMemoryMap,
    arcMemories,
    novelMemoryData,
    recentChapterContents,
  )
}

/** 加载完整的生成上下文（配置 + 记忆 + 意图） */
export async function loadGenerationContext(
  novelId: string,
  chapterNumber: number,
): Promise<LoadedContext> {
  const { config, provider } = await loadNovelConfig(novelId)
  const memoryContext = await loadMemoryContext(novelId, chapterNumber)

  // 章节意图规划（纯规则，零 LLM 成本）
  const chapterIntent =
    chapterNumber > 1 ? await planChapter(novelId, chapterNumber, memoryContext) : undefined

  return { config, provider, memoryContext, chapterIntent }
}

/** 构建消息数组 */
export function buildMessages(
  config: NovelConfig,
  chapterNumber: number,
  memoryContext?: MemoryContext,
  chapterIntent?: ChapterIntent,
): ChatMessage[] {
  const system = getSystemPrompt()
  const user = getChapterPrompt(config, chapterNumber, memoryContext, chapterIntent)
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/** SSE 流式生成章节（返回 ReadableStream + 完成后的章节信息） */
export function createChapterStream(
  provider: AIProvider,
  messages: ChatMessage[],
): {
  stream: ReadableStream
  getFullContent: () => string
} {
  const encoder = new TextEncoder()
  let fullContent = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of provider.generateStream(messages)) {
          fullContent += chunk
          const data = JSON.stringify({ type: 'chunk', content: chunk })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }
      } catch (error) {
        const errorData = JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Generation failed',
        })
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return {
    stream,
    getFullContent: () => fullContent,
  }
}

/**
 * 使用 Pipeline 架构生成章节
 * Writer → Observer → Settler → Auditor → Reviser
 * 返回 ReadableStream（SSE 格式）+ 完成后的章节内容
 */
export function createPipelineChapterStream(
  provider: AIProvider,
  config: NovelConfig,
  chapterNumber: number,
  novelId: string,
  memoryContext?: MemoryContext,
  chapterIntent?: ChapterIntent,
): {
  stream: ReadableStream
  getFullContent: () => string
} {
  const encoder = new TextEncoder()
  let fullContent = ''

  // 加载上一章内容（用于审计）
  let previousChapterContent: string | undefined

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 预加载上一章内容
        if (chapterNumber > 1) {
          const prevChapter = await prisma.chapter.findFirst({
            where: { novelId, number: chapterNumber - 1 },
            select: { content: true },
          })
          previousChapterContent = prevChapter?.content
        }

        const pipelineCtx: PipelineContext = {
          novelId,
          chapterNumber,
          novelConfig: config,
          provider,
          memoryContext,
          chapterIntent,
          previousChapterContent,
        }

        const result = await runPipeline(pipelineCtx, {
          onStreamChunk: (text) => {
            fullContent += text
            const data = JSON.stringify({ type: 'chunk', content: text })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          },
          onStageChange: (stage) => {
            // 阶段切换事件（前端可选择忽略）
            const data = JSON.stringify({ type: 'stage', stage })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          },
        })

        fullContent = result.writerOutput.fullText
      } catch (error) {
        const errorData = JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Pipeline failed',
        })
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return { stream, getFullContent: () => fullContent }
}

/** 解析章节标题和内容 */
export function parseChapterOutput(
  fullContent: string,
  chapterNumber: number,
): { title: string; content: string; wordCount: number } {
  const lines = fullContent.trim().split('\n')
  const firstLine = lines[0]
  const titleMatch = firstLine.match(/^第\d+章[：:]\s*(.+)/)
  const title = titleMatch ? titleMatch[1].trim() : `第${chapterNumber}章`
  const content = titleMatch ? lines.slice(1).join('\n').trim() : fullContent.trim()
  return { title, content, wordCount: content.length }
}
