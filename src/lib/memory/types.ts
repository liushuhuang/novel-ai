// ─── Core data structures (inspired by InkOS truth files) ───

export interface PlotThread {
  description: string
  status: 'open' | 'progressing' | 'resolved'
  introducedIn: number
  lastSeenIn: number
}

export interface ForeshadowingItem {
  hint: string
  chapterIntroduced: number
  resolved: boolean
  resolution?: string
}

export interface CharacterInfo {
  name: string
  role: string
  traits: string[]
  currentState: string
  lastSeenIn: number
}

export interface EmotionShift {
  character: string
  shift: string
  trigger: string
}

export interface ResourceChange {
  character: string
  item: string
  delta: string
}

export interface RelationshipChange {
  from: string
  to: string
  change: string
}

export interface ChapterMemoryData {
  summary: string
  characters: string[]
  threads: PlotThread[]
  foreshadowing: string[]
  locations: string[]
  events: string[]
  emotions: EmotionShift[]
  resources: ResourceChange[]
  relationships: RelationshipChange[]
  resolvedForeshadowing: string[]
  /** 章节类型（晨会、日常办公、外勤调查、情感互动、冲突对峙、回忆闪回等） */
  chapterType?: string
  /** 情绪基调（高张力、轻松、日常、中性、温馨、紧张、压抑） */
  mood?: string
}

export interface ArcMemoryData {
  summary: string
  keyEvents: string[]
  activeThreads: PlotThread[]
}

export interface NovelMemoryData {
  characters: CharacterInfo[]
  worldRules: string[]
  majorEvents: string[]
  openThreads: PlotThread[]
  foreshadowing: ForeshadowingItem[]
  lastChapterNum: number
  /** 已使用的元素追踪（防止重复） */
  usedElements?: UsedElements
}

/** 已使用的元素追踪 */
export interface UsedElements {
  /** 已使用的场景类型及次数 */
  sceneTypes: Record<string, number>
  /** 已使用的地点及次数 */
  locations: Record<string, number>
  /** 最近 N 章的章节类型序列 */
  recentChapterTypes: string[]
}

export interface MemoryContext {
  previousChapterSummary: string
  /** 上一章关键事件列表 */
  previousChapterEvents: string
  recentEndings: string
  arcSummary: string
  characters: string
  openThreads: string
  foreshadowing: string
  recentlyResolved: string
  relationships: string
  /** 叙事锚点：上一章结尾场景，确保章节衔接 */
  narrativeAnchor?: string
}
