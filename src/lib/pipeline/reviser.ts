import type { ChatMessage, AIProvider } from '@/types/ai'
import type { AuditResult, ReviserOutput } from './types'
import { parseSpotFixPatches, applySpotFixPatches } from './spot-fix'

const REVISER_SYSTEM_PROMPT = `你是一位小说修订编辑。根据审计报告中发现的问题，用最小改动修复章节。

修订规则：
- 只修复 critical 和 warning 级别的问题
- 每个修复用以下格式标记：

TARGET_TEXT:
<要替换的原文片段，必须与原文完全一致>

REPLACEMENT_TEXT:
<替换后的内容>

- 不要改动没有问题的部分
- 不要添加新的内容，只修改有问题的部分
- 如果没有需要修复的问题，输出 "NO_CHANGES_NEEDED"`

/**
 * Reviser Agent — spot-fix 修补
 * 一次 LLM 调用，temperature=0.3
 */
export async function runReviser(
  provider: AIProvider,
  chapterContent: string,
  auditResult: AuditResult,
): Promise<ReviserOutput> {
  // 只处理 critical + warning 问题
  const fixableIssues = auditResult.issues.filter(
    i => i.severity === 'critical' || i.severity === 'warning',
  )

  if (fixableIssues.length === 0) {
    return { revisedContent: chapterContent, patches: [], wasRevised: false }
  }

  const issuesText = fixableIssues
    .map((i, idx) => `${idx + 1}. [${i.severity}] ${i.category}：${i.description}\n   建议：${i.suggestion}`)
    .join('\n\n')

  const messages: ChatMessage[] = [
    { role: 'system', content: REVISER_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `需要修复的问题：\n\n${issuesText}\n\n原文：\n${chapterContent}\n\n请输出修复补丁。`,
    },
  ]

  let rawOutput = ''
  for await (const chunk of provider.generateStream(messages)) {
    rawOutput += chunk
  }

  // 检查是否无需修改
  if (rawOutput.includes('NO_CHANGES_NEEDED')) {
    return { revisedContent: chapterContent, patches: [], wasRevised: false }
  }

  // 解析并应用补丁
  const patches = parseSpotFixPatches(rawOutput)
  if (patches.length === 0) {
    return { revisedContent: chapterContent, patches: [], wasRevised: false }
  }

  const result = applySpotFixPatches(chapterContent, patches)

  return {
    revisedContent: result.content,
    patches: patches.slice(0, result.applied),
    wasRevised: result.applied > 0,
  }
}
