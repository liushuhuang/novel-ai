import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getTitlePrompt } from '@/lib/prompts/title'
import { runMemoryExtraction } from '@/lib/memory/extract'
import { loadGenerationContext, createPipelineChapterStream, parseChapterOutput } from '@/lib/generation/pipeline'
import { auditChapter } from '@/lib/planning/audit'
import { checkRateLimit } from '@/lib/rate-limit'
import type { ChatMessage } from '@/types/ai'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
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
      chapters: { orderBy: { number: 'desc' }, take: 1 },
    },
  })

  if (!novel) {
    return NextResponse.json({ error: 'Novel not found' }, { status: 404 })
  }

  const nextChapterNumber = novel.chapters.length > 0
    ? novel.chapters[0].number + 1
    : 1

  const { config, provider, memoryContext, chapterIntent } = await loadGenerationContext(
    id,
    nextChapterNumber,
  )

  const { stream: aiStream, getFullContent } = createPipelineChapterStream(
    provider,
    config,
    nextChapterNumber,
    id,
    memoryContext,
    chapterIntent,
  )

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = aiStream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }

        const fullContent = getFullContent()
        if (!fullContent) {
          controller.close()
          return
        }

        const { title, content, wordCount } = parseChapterOutput(fullContent, nextChapterNumber)

        await prisma.chapter.create({
          data: {
            novelId: id,
            number: nextChapterNumber,
            title,
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
            for await (const chunk of provider.generateStream(titleMsgs)) {
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

        // Fire-and-forget: consistency audit
        if (nextChapterNumber > 1) {
          const prevChapter = await prisma.chapter.findFirst({
            where: { novelId: id, number: nextChapterNumber - 1 },
            select: { content: true },
          })
          auditChapter(provider, content, prevChapter?.content ?? null, memoryContext)
            .then(result => {
              if (!result.passed) {
                console.warn(`Chapter ${nextChapterNumber} audit issues:`, JSON.stringify(result.issues))
              }
            })
            .catch(err => console.error('Audit error:', err))
        }

        // Fire-and-forget background memory extraction
        runMemoryExtraction(id, nextChapterNumber).catch(err => {
          console.error('Background memory extraction failed:', err)
        })

        const done = JSON.stringify({
          type: 'done',
          chapter: nextChapterNumber,
          title,
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
