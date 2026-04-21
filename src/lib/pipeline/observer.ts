import type { ChatMessage } from '@/types/ai'
import type { AIProvider } from '@/types/ai'
import type { ObserverOutput } from './types'

const OBSERVER_SYSTEM_PROMPT = `你是一位专业的小说事实提取器。你的任务是从给定的章节中提取所有可观测的事实变化。

提取规则：
- 宁多勿少，捕获所有可能的事实变化
- 按 9 个维度分类提取
- 输出必须是合法的 JSON，不要输出任何其他内容

输出格式（严格 JSON）：
{
  "characters": [{"name": "角色名", "action": "本章做了什么", "stateChange": "状态变化（可选）"}],
  "locations": [{"name": "地点名", "change": "变化描述"}],
  "resources": [{"name": "资源/物品名", "change": "变化描述"}],
  "relationships": [{"from": "角色A", "to": "角色B", "change": "关系变化"}],
  "emotions": [{"name": "角色名", "change": "情绪变化"}],
  "informationFlow": ["角色A从角色B获知了X"],
  "plotThreads": [{"thread": "剧情线描述", "status": "advanced|resolved|introduced"}],
  "timeline": "本章时间描述",
  "physicalState": [{"name": "角色名", "change": "身体状态变化"}],
  "chapterType": "scene|action|dialogue|transition|mixed",
  "mood": "本章情绪基调"
}`

/**
 * Observer Agent — 事实提取
 * 一次 LLM 调用，temperature 低以确保准确性
 */
export async function runObserver(
  provider: AIProvider,
  chapterTitle: string,
  chapterContent: string,
  chapterNumber: number,
): Promise<ObserverOutput> {
  const messages: ChatMessage[] = [
    { role: 'system', content: OBSERVER_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `请从以下第${chapterNumber}章中提取事实变化。\n\n标题：${chapterTitle}\n\n内容：\n${chapterContent}`,
    },
  ]

  let rawOutput = ''
  for await (const chunk of provider.generateStream(messages)) {
    rawOutput += chunk
  }

  // 解析 JSON（可能被 ```json ``` 包裹）
  const jsonStr = extractJson(rawOutput)
  try {
    const parsed = JSON.parse(jsonStr)
    return normalizeObserverOutput(parsed)
  } catch {
    // 解析失败时返回空输出
    return {
      characters: [],
      locations: [],
      resources: [],
      relationships: [],
      emotions: [],
      informationFlow: [],
      plotThreads: [],
      timeline: '',
      physicalState: [],
      chapterType: 'mixed',
      mood: '中性',
    }
  }
}

function extractJson(text: string): string {
  // 去掉 ```json ``` 包裹
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (match) return match[1].trim()
  // 尝试找到 { ... } 块
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1)
  }
  return text.trim()
}

function normalizeObserverOutput(raw: Record<string, unknown>): ObserverOutput {
  return {
    characters: Array.isArray(raw.characters) ? raw.characters : [],
    locations: Array.isArray(raw.locations) ? raw.locations : [],
    resources: Array.isArray(raw.resources) ? raw.resources : [],
    relationships: Array.isArray(raw.relationships) ? raw.relationships : [],
    emotions: Array.isArray(raw.emotions) ? raw.emotions : [],
    informationFlow: Array.isArray(raw.informationFlow) ? raw.informationFlow : [],
    plotThreads: Array.isArray(raw.plotThreads)
      ? raw.plotThreads.map((t: Record<string, unknown>) => ({
          thread: String(t.thread ?? ''),
          status: (t.status as string) === 'resolved' ? 'resolved' as const
            : (t.status as string) === 'introduced' ? 'introduced' as const
            : 'advanced' as const,
        }))
      : [],
    timeline: typeof raw.timeline === 'string' ? raw.timeline : '',
    physicalState: Array.isArray(raw.physicalState) ? raw.physicalState : [],
    chapterType: typeof raw.chapterType === 'string' ? raw.chapterType : 'mixed',
    mood: typeof raw.mood === 'string' ? raw.mood : '中性',
  }
}
