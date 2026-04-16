import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const novel = await prisma.novel.findUnique({
    where: { id },
    include: {
      provider: { select: { id: true, name: true, type: true, baseUrl: true, model: true } },
      chapters: { orderBy: { number: 'asc' }, select: { id: true, number: true, title: true, content: true, wordCount: true, createdAt: true } },
    },
  })

  if (!novel) {
    return NextResponse.json({ error: 'Novel not found' }, { status: 404 })
  }

  return NextResponse.json(novel)
}
