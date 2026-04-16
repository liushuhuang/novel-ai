import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/crypto'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { name, type, baseUrl, apiKey, model, isDefault } = body

  if (isDefault) {
    await prisma.provider.updateMany({
      where: { isDefault: true, NOT: { id } },
      data: { isDefault: false },
    })
  }

  const updateData: Record<string, unknown> = { name, type, baseUrl, model, isDefault }
  if (apiKey) {
    updateData.apiKey = encrypt(apiKey)
  }

  const provider = await prisma.provider.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      type: true,
      baseUrl: true,
      model: true,
      isDefault: true,
      createdAt: true,
    },
  })

  return NextResponse.json(provider)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.provider.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
