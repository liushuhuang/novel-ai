/** 章节意图 — 每章生成前的规划输出 */
export interface ChapterIntent {
  chapter: number
  /** 本章核心目标（1-2 句话） */
  goal: string
  /** 场景指令：强制要求的场景类型/地点变化 */
  sceneDirective?: string
  /** 情绪指令：强制要求的情绪基调变化 */
  moodDirective?: string
  /** 必须保持的元素 */
  mustKeep: string[]
  /** 必须避免的元素（已过度使用的场景/描写/任务） */
  mustAvoid: string[]
  /** 伏笔议程 */
  hookAgenda: {
    mustAdvance: string[]
    shouldResolve: string[]
    staleDebt: string[]
  }
}

/** 章节节奏分析结果 */
export interface CadenceAnalysis {
  /** 最近 N 章的场景类型列表 */
  recentSceneTypes: string[]
  /** 连续相同场景类型的数量 */
  sceneStreak: number
  /** 场景压力：high = 连续 3+ 次相同类型 */
  scenePressure: 'none' | 'medium' | 'high'
  /** 最近 N 章的情绪基调列表 */
  recentMoods: string[]
  /** 连续高张力情绪的数量 */
  moodStreak: number
  /** 情绪压力 */
  moodPressure: 'none' | 'medium' | 'high'
  /** 检测到的重复描写模式 */
  repeatedPatterns: string[]
}
