import { getSystemPrompt } from '@/lib/prompts/system'
import { getGenreRules } from '@/lib/prompts/genre-rules'
import { getAntiAIExamples } from '@/lib/prompts/anti-ai'
import type { MemoryContext } from '@/lib/memory/types'
import type { ChapterIntent } from '@/lib/planning/types'
import type { PipelineContext } from './types'

const TARGET_LABELS: Record<string, string> = {
  male: '男频',
  female: '女频',
  unisex: '通用',
}
const WORD_COUNT_LABELS: Record<string, string> = {
  short: '短篇(1-3万字，每章约2000字)',
  medium: '中篇(3-10万字，每章约3000字)',
  long: '长篇(10万+，每章约3000-5000字)',
}

/** 构建 Writer 的 system prompt（不包含工具指令） */
export function buildWriterSystemPrompt(ctx: PipelineContext): string {
  const { novelConfig: config, chapterNumber, memoryContext, chapterIntent } = ctx

  let prompt = getSystemPrompt()

  prompt += `\n\n## 小说设定\n`
  prompt += `- 类型：${config.genre}\n`
  prompt += `- 频道：${TARGET_LABELS[config.target] ?? config.target}\n`
  prompt += `- 篇幅：${WORD_COUNT_LABELS[config.wordCount] ?? config.wordCount}\n`
  prompt += `- 风格：${config.style}\n`
  prompt += `- 视角：${config.pov}\n`
  prompt += `- 背景：${config.background === '自定义' ? config.backgroundCustom : config.background}\n`

  if (config.protagonist) prompt += `- 主角设定：${config.protagonist}\n`
  if (config.conflict) prompt += `- 核心冲突：${config.conflict}\n`
  if (config.customNote) prompt += `- 补充说明：${config.customNote}\n`

  const genreRules = getGenreRules(config.genre)
  if (genreRules) prompt += `\n${genreRules}\n`

  prompt += `\n${getAntiAIExamples()}\n`

  // 章节意图
  if (chapterIntent) {
    prompt += `\n## 本章写作规划（必须遵守）\n`
    prompt += `本章核心目标：${chapterIntent.goal}\n`
    if (chapterIntent.sceneDirective)
      prompt += `【场景指令】${chapterIntent.sceneDirective}\n`
    if (chapterIntent.moodDirective)
      prompt += `【情绪指令】${chapterIntent.moodDirective}\n`
    if (chapterIntent.mustAvoid.length > 0) {
      prompt += `【禁止事项】\n${chapterIntent.mustAvoid.map(a => `- ${a}`).join('\n')}\n`
    }
    if (chapterIntent.mustKeep.length > 0) {
      prompt += `【必须保持】\n${chapterIntent.mustKeep.map(k => `- ${k}`).join('\n')}\n`
    }
    if (chapterIntent.hookAgenda.mustAdvance.length > 0) {
      prompt += `【本章必须推进的伏笔】\n${chapterIntent.hookAgenda.mustAdvance.map(h => `- ${h}`).join('\n')}\n`
    }
    if (chapterIntent.hookAgenda.staleDebt.length > 0) {
      prompt += `【超期未处理伏笔】\n${chapterIntent.hookAgenda.staleDebt.map(h => `- ${h}`).join('\n')}\n`
    }
  }

  // 记忆上下文
  if (memoryContext && chapterNumber > 1) {
    prompt += `\n\n## 上下文信息\n`
    if (memoryContext.narrativeAnchor) {
      prompt += `\n### 叙事衔接（上一章结尾）\n${memoryContext.narrativeAnchor}\n请从上述场景自然衔接。\n`
    }
    if (memoryContext.previousChapterSummary) {
      prompt += `\n### 上一章概要\n${memoryContext.previousChapterSummary}\n`
    }
    if (memoryContext.previousChapterEvents) {
      prompt += `\n### 上一章关键事件\n${memoryContext.previousChapterEvents}\n`
    }
    if (memoryContext.recentEndings) {
      prompt += `\n### 近期章节结尾（注意避免结构重复）\n${memoryContext.recentEndings}\n`
    }
    if (memoryContext.arcSummary) {
      prompt += `\n### 当前篇章概要\n${memoryContext.arcSummary}\n`
    }
    if (memoryContext.characters) {
      prompt += `\n### 角色状态\n${memoryContext.characters}\n`
    }
    if (memoryContext.openThreads) {
      prompt += `\n### 未完结剧情线\n${memoryContext.openThreads}\n`
    }
    if (memoryContext.foreshadowing) {
      prompt += `\n### 伏笔池\n${memoryContext.foreshadowing}\n`
    }
    if (memoryContext.recentlyResolved) {
      prompt += `\n### 近期已回收伏笔\n${memoryContext.recentlyResolved}\n`
    }
  }

  prompt += `\n\n## 你的任务\n`
  prompt += `直接创作第${chapterNumber}章的完整正文（${chapterNumber === 1 ? '从头开始，建立世界观、引入主角和核心冲突' : '延续上一章剧情，保持情节连贯'}）。\n\n`
  prompt += `请直接输出章节内容，格式为"第${chapterNumber}章：标题"，然后是正文。不要输出任何与小说正文无关的内容。\n\n`
  prompt += `【再次强调】正文中严禁出现任何真实公司名、品牌名、国家名、城市名。所有组织和地名必须完全虚构。`

  return prompt
}
