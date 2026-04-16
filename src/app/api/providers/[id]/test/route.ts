import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { createAIProvider } from '@/lib/ai/factory'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const provider = await prisma.provider.findUnique({ where: { id } })
  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
  }

  try {
    const aiProvider = createAIProvider({
      baseUrl: provider.baseUrl,
      apiKey: decrypt(provider.apiKey),
      model: provider.model,
      type: provider.type,
    })

    const success = await aiProvider.testConnection()
    return NextResponse.json({ success })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    })
  }
}
