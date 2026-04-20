import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkRateLimit } from '@/lib/rate-limit'

export async function DELETE(
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

  const novel = await prisma.novel.findUnique({ where: { id } })
  if (!novel) {
    return NextResponse.json({ error: 'Novel not found' }, { status: 404 })
  }

  await prisma.chapter.delete({
    where: { novelId_number: { novelId: id, number: chapterNumber } },
  })

  await prisma.chapterMemory.deleteMany({
    where: { novelId: id, chapterNumber },
  })

  return NextResponse.json({ success: true })
}
