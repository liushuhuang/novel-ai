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
  previousChapterSummary?: string
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

  if (chapterNumber === 1) {
    prompt += `\n\n这是小说的第一章。请从头开始创作，建立世界观、引入主角和核心冲突。`
  } else if (previousChapterSummary) {
    prompt += `\n\n上一章概要：\n${previousChapterSummary}\n\n请在此基础上继续创作。`
  }

  prompt += `\n\n请直接输出章节内容，格式为"第${chapterNumber}章：标题"，然后是正文。`

  return prompt
}
