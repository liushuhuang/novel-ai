import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const novels = await prisma.novel.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      provider: { select: { name: true } },
      _count: { select: { chapters: true } },
    },
  })
  return NextResponse.json(novels)
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    providerId, genre, target, wordCount, style, pov, background,
    protagonist, conflict, customNote,
  } = body

  if (!providerId || !genre || !target || !wordCount || !style || !pov || !background) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  const novel = await prisma.novel.create({
    data: {
      title: '生成中...',
      providerId,
      genre,
      target,
      wordCount,
      style,
      pov,
      background,
      protagonist: protagonist || null,
      conflict: conflict || null,
      customNote: customNote || null,
      status: 'generating',
    },
  })

  return NextResponse.json(novel, { status: 201 })
}
