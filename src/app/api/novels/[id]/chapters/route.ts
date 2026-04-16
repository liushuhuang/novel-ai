import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const chapters = await prisma.chapter.findMany({
    where: { novelId: id },
    orderBy: { number: 'asc' },
    select: {
      id: true,
      number: true,
      title: true,
      content: true,
      wordCount: true,
      createdAt: true,
    },
  })
  return NextResponse.json(chapters)
}
