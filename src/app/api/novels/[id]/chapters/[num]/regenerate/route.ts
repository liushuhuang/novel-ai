import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { createAIProvider } from '@/lib/ai/factory'
import { getSystemPrompt } from '@/lib/prompts/system'
import { getChapterPrompt } from '@/lib/prompts/chapter'
import type { ChatMessage } from '@/types/ai'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; num: string }> }
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

  const chapterPrompt = getChapterPrompt(config, chapterNumber)

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
        const chapterTitle = titleMatch ? titleMatch[1].trim() : `第${chapterNumber}章`
        const content = titleMatch
          ? lines.slice(1).join('\n').trim()
          : fullContent.trim()

        const wordCount = content.length

        await prisma.chapter.upsert({
          where: { novelId_number: { novelId: id, number: chapterNumber } },
          update: { title: chapterTitle, content, wordCount },
          create: { novelId: id, number: chapterNumber, title: chapterTitle, content, wordCount },
        })

        const done = JSON.stringify({
          type: 'done',
          chapter: chapterNumber,
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
