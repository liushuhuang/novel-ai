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
}

export interface MemoryContext {
  previousChapterSummary: string
  recentEndings: string
  arcSummary: string
  characters: string
  openThreads: string
  foreshadowing: string
  recentlyResolved: string
  relationships: string
}
