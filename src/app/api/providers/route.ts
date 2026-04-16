import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/crypto'

export async function GET() {
  const providers = await prisma.provider.findMany({
    orderBy: { createdAt: 'desc' },
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
  return NextResponse.json(providers)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { name, type, baseUrl, apiKey, model, isDefault } = body

  if (!name || !type || !model || !apiKey) {
    return NextResponse.json(
      { error: 'Missing required fields: name, type, model, apiKey' },
      { status: 400 }
    )
  }

  if (isDefault) {
    await prisma.provider.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
  }

  const provider = await prisma.provider.create({
    data: {
      name,
      type,
      baseUrl: baseUrl ?? '',
      apiKey: encrypt(apiKey),
      model,
      isDefault: isDefault ?? false,
    },
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

  return NextResponse.json(provider, { status: 201 })
}
