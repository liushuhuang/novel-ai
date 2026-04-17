import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { createAIProvider } from '@/lib/ai/factory'
import { getSystemPrompt } from '@/lib/prompts/system'
import { getChapterPrompt } from '@/lib/prompts/chapter'
import { getTitlePrompt } from '@/lib/prompts/title'
import { assembleMemoryContext } from '@/lib/memory/assemble'
import { runMemoryExtraction } from '@/lib/memory/extract'
import type { ChatMessage } from '@/types/ai'
import type { MemoryContext, ChapterMemoryData, ArcMemoryData } from '@/lib/memory/types'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0] ?? 'unknown'
  const { allowed } = checkRateLimit(ip)
  if (!allowed) {
    return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 })
  }

  const { id } = await params

  const novel = await prisma.novel.findUnique({
    where: { id },
    include: {
      provider: true,
      chapters: { orderBy: { number: 'desc' }, take: 1 },
    },
  })

  if (!novel) {
    return NextResponse.json({ error: 'Novel not found' }, { status: 404 })
  }

  const nextChapterNumber = novel.chapters.length > 0
    ? novel.chapters[0].number + 1
    : 1

  const config = {
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

  // Load memory context for chapters > 1
  let memoryContext: MemoryContext | undefined
  if (nextChapterNumber > 1) {
    const [chapterMems, arcMems, novelMem, recentChapters] = await Promise.all([
      prisma.chapterMemory.findMany({
        where: { novelId: id },
        orderBy: { chapterNumber: 'asc' },
      }),
      prisma.arcMemory.findMany({
        where: { novelId: id },
        orderBy: { arcStart: 'asc' },
      }),
      prisma.novelMemory.findUnique({
        where: { novelId: id },
      }),
      prisma.chapter.findMany({
        where: { novelId: id, number: { gte: nextChapterNumber - 3, lt: nextChapterNumber } },
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

    const novelMemoryData = novelMem ? {
      characters: JSON.parse(novelMem.characters || '[]'),
      worldRules: JSON.parse(novelMem.worldRules || '[]'),
      majorEvents: JSON.parse(novelMem.majorEvents || '[]'),
      openThreads: JSON.parse(novelMem.openThreads || '[]'),
      foreshadowing: JSON.parse(novelMem.foreshadowing || '[]'),
      lastChapterNum: novelMem.lastChapterNum,
    } : null

    const recentChapterContents = new Map<number, string>()
    for (const ch of recentChapters) {
      recentChapterContents.set(ch.number, ch.content)
    }

    memoryContext = assembleMemoryContext(
      nextChapterNumber,
      chapterMemoryMap,
      arcMemories,
      novelMemoryData,
      recentChapterContents,
    )
  }

  const chapterPrompt = getChapterPrompt(config, nextChapterNumber, memoryContext)

  const messages: ChatMessage[] = [
    { role: 'system', content: getSystemPrompt() },
    { role: 'user', content: chapterPrompt },
  ]

  let apiKey: string
  try {
    apiKey = decrypt(novel.provider.apiKey)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt API key' }, { status: 500 })
  }

  const aiProvider = createAIProvider({
    baseUrl: novel.provider.baseUrl,
    apiKey,
    model: novel.provider.model,
    type: novel.provider.type,
  })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = ''

      try {
        for await (const chunk of aiProvider.generateStream(messages)) {
          fullContent += chunk
          const data = JSON.stringify({ type: 'chunk', content: chunk })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }

        const lines = fullContent.trim().split('\n')
        const firstLine = lines[0]
        const titleMatch = firstLine.match(/^第\d+章[：:]\s*(.+)/)
        const chapterTitle = titleMatch
          ? titleMatch[1].trim()
          : `第${nextChapterNumber}章`
        const content = titleMatch
          ? lines.slice(1).join('\n').trim()
          : fullContent.trim()

        const wordCount = content.length
        await prisma.chapter.create({
          data: {
            novelId: id,
            number: nextChapterNumber,
            title: chapterTitle,
            content,
            wordCount,
          },
        })

        if (nextChapterNumber === 1 && novel.title === '生成中...') {
          try {
            const titleMsgs: ChatMessage[] = [
              { role: 'system', content: '你是一位起名高手。' },
              { role: 'user', content: getTitlePrompt(config, content) },
            ]
            let titleContent = ''
            for await (const chunk of aiProvider.generateStream(titleMsgs)) {
              titleContent += chunk
            }
            const novelTitle = titleContent.trim().replace(/[《》""'']/g, '')
            if (novelTitle) {
              await prisma.novel.update({
                where: { id },
                data: { title: novelTitle },
              })
            }
          } catch {
            // Title generation is optional
          }
        }

        // Fire-and-forget background memory extraction
        runMemoryExtraction(id, nextChapterNumber).catch(err => {
          console.error('Background memory extraction failed:', err)
        })

        const done = JSON.stringify({
          type: 'done',
          chapter: nextChapterNumber,
          title: chapterTitle,
          wordCount,
        })
        controller.enqueue(encoder.encode(`data: ${done}\n\n`))
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

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
