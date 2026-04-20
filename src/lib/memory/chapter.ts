import type { AIProvider, ChatMessage } from '@/types/ai'
import type { ChapterMemoryData } from './types'

const OBSERVER_PROMPT = `你是一个小说事实提取专家。从章节正文中提取所有可观察到的事实变化。宁多勿少，不确定是否重要时也要记录。

## 提取维度

1. **角色行为**：谁做了什么，对谁
2. **位置变化**：谁从哪到哪
3. **资源变化**：物品获得/失去/消耗
4. **关系变化**：信任转变、结盟、背叛
5. **情绪变化**：角色情绪从X到Y，触发事件
6. **信息流动**：谁得知了什么，谁仍不知
7. **剧情线索**：新悬念、已有线索推进、线索回收
8. **时间推进**：时间标记、时长
9. **身体状态**：受伤、恢复、战力变化
10. **伏笔回收**：检查是否有之前埋下的伏笔在本章被兑现/回收
11. **章节类型**：判断本章属于哪种类型（会议汇报、日常办公、外勤调查、情感互动、冲突对峙、回忆闪回、训练战斗、其他），给出一个关键词
12. **情绪基调**：判断本章整体情绪（高张力、轻松、日常、中性、温馨、紧张、压抑）

## 输出格式（严格JSON，不要任何其他文字）

{
  "summary": "2-3句话的章节概要（150字以内）",
  "characters": ["出场角色名"],
  "threads": [{"description": "剧情线描述", "status": "open|progressing|resolved", "introducedIn": 章节号, "lastSeenIn": 章节号}],
  "foreshadowing": ["新埋伏笔描述"],
  "resolvedForeshadowing": ["已回收的伏笔描述（本章中兑现的伏笔）"],
  "locations": ["出现的地点"],
  "events": ["关键事件"],
  "emotions": [{"character": "角色名", "shift": "情绪变化", "trigger": "触发事件"}],
  "resources": [{"character": "角色名", "item": "物品", "delta": "变化"}],
  "relationships": [{"from": "角色A", "to": "角色B", "change": "关系变化"}],
  "chapterType": "章节类型关键词",
  "mood": "情绪基调关键词"
}

规则：
- 只从正文提取，不推测
- threads的introducedIn和lastSeenIn用实际章节号
- 如果某个维度本章没有变化，返回空数组
- resolvedForeshadowing只记录本章内容中确实兑现了的伏笔，不确定的不要记录
- chapterType 和 mood 必须填写，不能为空`

export async function extractChapterMemory(
  aiProvider: AIProvider,
  chapterNumber: number,
  chapterContent: string,
): Promise<ChapterMemoryData> {
  const messages: ChatMessage[] = [
    { role: 'system', content: OBSERVER_PROMPT },
    { role: 'user', content: `请提取第${chapterNumber}章中的所有事实：\n\n${chapterContent}` },
  ]

  let result = ''
  for await (const chunk of aiProvider.generateStream(messages)) {
    result += chunk
  }

  const cleaned = result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')

  try {
    const parsed = JSON.parse(cleaned)
    return {
      summary: parsed.summary ?? '',
      characters: parsed.characters ?? [],
      threads: parsed.threads ?? [],
      foreshadowing: parsed.foreshadowing ?? [],
      resolvedForeshadowing: parsed.resolvedForeshadowing ?? [],
      locations: parsed.locations ?? [],
      events: parsed.events ?? [],
      emotions: parsed.emotions ?? [],
      resources: parsed.resources ?? [],
      relationships: parsed.relationships ?? [],
      chapterType: parsed.chapterType ?? '',
      mood: parsed.mood ?? '',
    }
  } catch {
    return {
      summary: result.trim().slice(0, 300),
      characters: [],
      threads: [],
      foreshadowing: [],
      resolvedForeshadowing: [],
      locations: [],
      events: [],
      emotions: [],
      resources: [],
      relationships: [],
      chapterType: '',
      mood: '',
    }
  }
}
