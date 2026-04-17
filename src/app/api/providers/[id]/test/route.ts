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

  let apiKey: string
  try {
    apiKey = decrypt(provider.apiKey)
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: 'API Key 解密失败，请重新添加供应商',
    })
  }

  try {
    const aiProvider = createAIProvider({
      baseUrl: provider.baseUrl,
      apiKey,
      model: provider.model,
      type: provider.type,
    })

    const success = await aiProvider.testConnection()
    return NextResponse.json({ success })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection test failed'
    console.error('Provider test failed:', {
      providerId: id,
      type: provider.type,
      baseUrl: provider.baseUrl,
      model: provider.model,
      error: message,
    })
    return NextResponse.json({ success: false, error: message })
  }
}
