import type { PipelineContext, PipelineResult } from './types'
import { runWriter } from './writer'
import { runObserver } from './observer'
import { runSettler } from './settler'
import { runAuditor } from './auditor'
import { runReviser } from './reviser'

export interface PipelineCallbacks {
  /** 写作阶段的流式文本片段回调 */
  onStreamChunk?: (text: string) => void
  /** 阶段切换回调 */
  onStageChange?: (stage: string) => void
}

/**
 * Pipeline 编排器 — 串联 Writer → Observer → Settler → Auditor → Reviser
 *
 * 每阶段是独立的 LLM 调用，拥有专属 prompt。
 * 写作阶段支持流式输出（SSE 转发给前端）。
 */
export async function runPipeline(
  ctx: PipelineContext,
  callbacks: PipelineCallbacks,
): Promise<PipelineResult> {
  // 1. Writer — 创作
  callbacks.onStageChange?.('writing')
  const writerOutput = await runWriter(ctx, callbacks.onStreamChunk)

  // 2. Observer — 事实提取
  callbacks.onStageChange?.('observing')
  const observerOutput = await runObserver(
    ctx.provider,
    writerOutput.title,
    writerOutput.content,
    ctx.chapterNumber,
  )

  // 3. Settler — 记忆合并
  callbacks.onStageChange?.('settling')
  const settlerOutput = ctx.memoryContext
    ? await runSettler(ctx.provider, observerOutput, ctx.memoryContext, ctx.chapterNumber)
    : { summary: '', characterUpdates: [], newForeshadowing: [], resolvedForeshadowing: [], activeThreads: [] }

  // 4. Auditor — 质量审查
  callbacks.onStageChange?.('auditing')
  const auditResult = await runAuditor(
    ctx.provider,
    writerOutput.title,
    writerOutput.content,
    ctx.previousChapterContent,
    ctx.memoryContext,
  )

  // 5. Reviser — spot-fix 修补（仅在有 critical 问题时）
  let reviserOutput: PipelineResult['reviserOutput']

  if (!auditResult.passed && auditResult.issues.some(i => i.severity === 'critical')) {
    callbacks.onStageChange?.('revising')
    reviserOutput = await runReviser(ctx.provider, writerOutput.content, auditResult)
  } else {
    reviserOutput = { revisedContent: writerOutput.content, patches: [], wasRevised: false }
  }

  // 最终结果
  const finalContent = reviserOutput.wasRevised
    ? reviserOutput.revisedContent
    : writerOutput.content

  callbacks.onStageChange?.('done')

  return {
    writerOutput,
    observerOutput,
    settlerOutput,
    auditResult,
    reviserOutput,
    finalContent,
    finalTitle: writerOutput.title,
    finalWordCount: finalContent.length,
  }
}
