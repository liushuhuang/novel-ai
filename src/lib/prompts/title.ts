interface TitleConfig {
  genre: string
  style: string
  background: string
  backgroundCustom?: string
  conflict?: string
}

export function getTitlePrompt(config: TitleConfig, firstChapterContent: string): string {
  const excerpt = firstChapterContent.slice(0, 500)
  return `根据以下小说设定和第一章开头，为这部小说起一个吸引人的标题（10个字以内，不要书名号）：

类型：${config.genre}
风格：${config.style}
背景：${config.background === '自定义' ? config.backgroundCustom : config.background}
${config.conflict ? `核心冲突：${config.conflict}` : ''}

第一章开头：
${excerpt}

只输出标题文字，不要任何解释。`
}
