import type { AIProvider } from '@/types/ai'
import type { MemoryContext } from '@/lib/memory/types'
import type { ChapterIntent } from '@/lib/planning/types'

/** Pipeline 各阶段的共享上下文 */
export interface PipelineContext {
  novelId: string
  chapterNumber: number
  novelConfig: {
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
  provider: AIProvider
  memoryContext?: MemoryContext
  chapterIntent?: ChapterIntent
  /** 上一章全文（用于审计） */
  previousChapterContent?: string
}

/** Writer 阶段的输出 */
export interface WriterOutput {
  title: string
  content: string
  fullText: string
  wordCount: number
}

/** Observer 阶段的输出 */
export interface ObserverOutput {
  characters: Array<{ name: string; action: string; stateChange?: string }>
  locations: Array<{ name: string; change: string }>
  resources: Array<{ name: string; change: string }>
  relationships: Array<{ from: string; to: string; change: string }>
  emotions: Array<{ name: string; change: string }>
  informationFlow: string[]
  plotThreads: Array<{ thread: string; status: 'advanced' | 'resolved' | 'introduced' }>
  timeline: string
  physicalState: Array<{ name: string; change: string }>
  chapterType: string
  mood: string
}

/** Settler 阶段的输出 */
export interface SettlerOutput {
  summary: string
  characterUpdates: Array<{ name: string; role: string; currentState: string }>
  newForeshadowing: string[]
  resolvedForeshadowing: string[]
  activeThreads: string[]
}

/** 审计问题 */
export interface AuditIssue {
  severity: 'critical' | 'warning' | 'info'
  category: string
  description: string
  suggestion: string
}

/** Auditor 阶段的输出 */
export interface AuditResult {
  passed: boolean
  issues: AuditIssue[]
  scores: Record<string, number>
}

/** Spot-fix 补丁 */
export interface SpotFixPatch {
  targetText: string
  replacementText: string
}

/** Reviser 阶段的输出 */
export interface ReviserOutput {
  revisedContent: string
  patches: SpotFixPatch[]
  wasRevised: boolean
}

/** Pipeline 完整结果 */
export interface PipelineResult {
  writerOutput: WriterOutput
  observerOutput: ObserverOutput
  settlerOutput: SettlerOutput
  auditResult: AuditResult
  reviserOutput: ReviserOutput
  finalContent: string
  finalTitle: string
  finalWordCount: number
}
