import type { ChatMessage, AIProvider } from '@/types/ai'
import type { MemoryContext } from '@/lib/memory/types'
import type { ObserverOutput, SettlerOutput } from './types'

const SETTLER_SYSTEM_PROMPT = `你是一位小说记忆管理器。根据 Observer 提取的章节事实，决定如何更新记忆系统。

你的任务：
1. 生成本章的精炼摘要（100字以内）
2. 确定哪些角色状态需要更新
3. 识别新增和回收的伏笔
4. 确定活跃的剧情线

输出必须是严格的 JSON，不要输出任何其他内容。

输出格式：
{
  "summary": "本章摘要",
  "characterUpdates": [{"name": "角色名", "role": "角色定位", "currentState": "当前最新状态"}],
  "newForeshadowing": ["新增伏笔描述"],
  "resolvedForeshadowing": ["已回收伏笔描述"],
  "activeThreads": ["活跃剧情线描述"]
}`

/**
 * Settler Agent — 记忆合并
 * 一次 LLM 调用，temperature=0.3 确保结构化输出
 */
export async function runSettler(
  provider: AIProvider,
  observerOutput: ObserverOutput,
  memoryContext: MemoryContext,
  chapterNumber: number,
): Promise<SettlerOutput> {
  const observerJson = JSON.stringify(observerOutput, null, 2)

  let memoryBlock = ''
  if (memoryContext.characters) {
    memoryBlock += `### 当前角色状态\n${memoryContext.characters}\n\n`
  }
  if (memoryContext.openThreads) {
    memoryBlock += `### 未完结剧情线\n${memoryContext.openThreads}\n\n`
  }
  if (memoryContext.foreshadowing) {
    memoryBlock += `### 当前伏笔池\n${memoryContext.foreshadowing}\n\n`
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SETTLER_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `第${chapterNumber}章的事实提取结果：\n\n${observerJson}\n\n当前记忆状态：\n\n${memoryBlock}\n请根据以上信息生成记忆更新。`,
    },
  ]

  let rawOutput = ''
  for await (const chunk of provider.generateStream(messages)) {
    rawOutput += chunk
  }

  const jsonStr = extractJson(rawOutput)
  try {
    const parsed = JSON.parse(jsonStr)
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      characterUpdates: Array.isArray(parsed.characterUpdates) ? parsed.characterUpdates : [],
      newForeshadowing: Array.isArray(parsed.newForeshadowing) ? parsed.newForeshadowing : [],
      resolvedForeshadowing: Array.isArray(parsed.resolvedForeshadowing) ? parsed.resolvedForeshadowing : [],
      activeThreads: Array.isArray(parsed.activeThreads) ? parsed.activeThreads : [],
    }
  } catch {
    return {
      summary: '',
      characterUpdates: [],
      newForeshadowing: [],
      resolvedForeshadowing: [],
      activeThreads: [],
    }
  }
}

function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (match) return match[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1)
  }
  return text.trim()
}
