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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  const updateData: Record<string, unknown> = {}
  const allowedFields = [
    'genre', 'target', 'wordCount', 'style', 'pov', 'background',
    'protagonist', 'conflict', 'customNote',
  ]

  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field]
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 })
  }

  const novel = await prisma.novel.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(novel)
}
