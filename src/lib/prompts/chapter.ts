import type { MemoryContext } from '@/lib/memory/types'
import { getAntiAIExamples } from './anti-ai'
import { getGenreRules } from './genre-rules'

const TARGET_LABELS: Record<string, string> = { male: '男频', female: '女频', unisex: '通用' }
const WORD_COUNT_LABELS: Record<string, string> = {
  short: '短篇(1-3万字，每章约2000字)',
  medium: '中篇(3-10万字，每章约3000字)',
  long: '长篇(10万+，每章约3000-5000字)',
}

interface ChapterConfig {
  genre: string
  target: string
  wordCount: string
  style: string
  pov: string
  background: string
  backgroundCustom?: string
  protagonist?: string
  conflict?: string
  customNote?: string
}

export function getChapterPrompt(
  config: ChapterConfig,
  chapterNumber: number,
  memory?: MemoryContext,
): string {
  let prompt = `请创作小说的第${chapterNumber}章。

小说设定：
- 类型：${config.genre}
- 频道：${TARGET_LABELS[config.target] ?? config.target}
- 篇幅：${WORD_COUNT_LABELS[config.wordCount] ?? config.wordCount}
- 风格：${config.style}
- 视角：${config.pov}
- 背景：${config.background === '自定义' ? config.backgroundCustom : config.background}`

  if (config.protagonist) {
    prompt += `\n- 主角设定：${config.protagonist}`
  }
  if (config.conflict) {
    prompt += `\n- 核心冲突：${config.conflict}`
  }
  if (config.customNote) {
    prompt += `\n- 补充说明：${config.customNote}`
  }

  // 类型专属写作规范
  const genreRules = getGenreRules(config.genre)
  if (genreRules) {
    prompt += `\n\n${genreRules}`
  }

  // 反 AI 写作参考
  prompt += `\n\n${getAntiAIExamples()}`

  if (chapterNumber === 1) {
    prompt += `\n\n这是小说的第一章。请从头开始创作，建立世界观、引入主角和核心冲突。`
  } else if (memory) {
    prompt += `\n\n【上下文信息——请务必基于以下信息保持连贯性】`

    if (memory.previousChapterSummary) {
      prompt += `\n\n上一章概要：\n${memory.previousChapterSummary}`
    }

    if (memory.recentEndings) {
      prompt += `\n\n近期章节结尾（注意避免结构重复）：\n${memory.recentEndings}`
    }

    if (memory.arcSummary) {
      prompt += `\n\n当前篇章概要：\n${memory.arcSummary}`
    }

    if (memory.characters) {
      prompt += `\n\n出场人物状态：\n${memory.characters}`
    }

    if (memory.openThreads) {
      prompt += `\n\n未完结剧情线（请妥善推进或回收）：\n${memory.openThreads}`
    }

    if (memory.foreshadowing) {
      prompt += `\n\n待回收伏笔（请优先处理陈旧伏笔）：\n${memory.foreshadowing}`
    }

    if (memory.recentlyResolved) {
      prompt += `\n\n近期已回收伏笔（参考）：\n${memory.recentlyResolved}`
    }

    prompt += `\n\n请在此基础上继续创作，保持情节连贯，人物行为一致，妥善推进或回收以上剧情线和伏笔。`
  }

  prompt += `\n\n请直接输出章节内容，格式为"第${chapterNumber}章：标题"，然后是正文。

【再次强调】正文中严禁出现任何真实公司名、品牌名、国家名、城市名。所有组织和地名必须完全虚构。`

  return prompt
}
