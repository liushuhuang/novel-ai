export const GENRES = ['玄幻', '都市', '科幻', '武侠', '言情', '悬疑', '历史', '奇幻'] as const
export const TARGETS = [
  { value: 'male', label: '男频' },
  { value: 'female', label: '女频' },
  { value: 'unisex', label: '通用' },
] as const
export const WORD_COUNTS = [
  { value: 'short', label: '短篇 (1-3万字)' },
  { value: 'medium', label: '中篇 (3-10万字)' },
  { value: 'long', label: '长篇 (10万+)' },
] as const
export const STYLES = ['轻松幽默', '严肃正剧', '文艺抒情', '爽文快节奏'] as const
export const POVS = ['第一人称', '第三人称限知', '第三人称全知'] as const
export const BACKGROUNDS = ['现代都市', '古代王朝', '架空世界', '未来科幻', '自定义'] as const

export interface NovelConfig {
  providerId: string
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
