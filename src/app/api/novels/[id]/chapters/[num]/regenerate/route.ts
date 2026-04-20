import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runMemoryExtraction } from '@/lib/memory/extract'
import { loadGenerationContext, buildMessages, createChapterStream, parseChapterOutput } from '@/lib/generation/pipeline'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; num: string }> },
) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0] ?? 'unknown'
  const { allowed } = checkRateLimit(ip)
  if (!allowed) {
    return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 })
  }

  const { id, num } = await params
  const chapterNumber = parseInt(num, 10)

  const novel = await prisma.novel.findUnique({
    where: { id },
    include: { provider: true },
  })

  if (!novel) {
    return NextResponse.json({ error: 'Novel not found' }, { status: 404 })
  }

  const { config, provider, memoryContext, chapterIntent } = await loadGenerationContext(
    id,
    chapterNumber,
  )

  const messages = buildMessages(config, chapterNumber, memoryContext, chapterIntent)

  const { stream: aiStream, getFullContent } = createChapterStream(provider, messages)

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

        const { title, content, wordCount } = parseChapterOutput(fullContent, chapterNumber)

        await prisma.chapter.upsert({
          where: { novelId_number: { novelId: id, number: chapterNumber } },
          update: { title, content, wordCount },
          create: { novelId: id, number: chapterNumber, title, content, wordCount },
        })

        // Fire-and-forget background memory extraction
        runMemoryExtraction(id, chapterNumber).catch(err => {
          console.error('Background memory extraction failed:', err)
        })

        const done = JSON.stringify({
          type: 'done',
          chapter: chapterNumber,
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
