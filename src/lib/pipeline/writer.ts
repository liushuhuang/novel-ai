import type { ChatMessage } from '@/types/ai'
import type { PipelineContext, WriterOutput } from './types'
import { buildWriterSystemPrompt } from './prompts'
import { parseChapterOutput } from '@/lib/generation/pipeline'

/**
 * Writer Agent — 纯写作，不带工具调用
 * 一次 LLM 调用，流式输出，temperature 由 provider 默认值决定
 */
export async function runWriter(
  ctx: PipelineContext,
  onChunk?: (text: string) => void,
): Promise<WriterOutput> {
  const systemPrompt = buildWriterSystemPrompt(ctx)

  const userPrompt = ctx.chapterNumber === 1
    ? '现在开始创作第1章。直接创作完整的小说正文。'
    : `现在开始创作第${ctx.chapterNumber}章。延续上一章剧情，保持衔接自然。`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  let fullText = ''
  for await (const chunk of ctx.provider.generateStream(messages)) {
    fullText += chunk
    onChunk?.(chunk)
  }

  const parsed = parseChapterOutput(fullText, ctx.chapterNumber)
  return {
    title: parsed.title,
    content: parsed.content,
    fullText,
    wordCount: parsed.wordCount,
  }
}
