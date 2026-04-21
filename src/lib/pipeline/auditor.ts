import type { ChatMessage, AIProvider } from '@/types/ai'
import type { MemoryContext } from '@/lib/memory/types'
import type { AuditResult, AuditIssue } from './types'

const AUDIT_DIMENSIONS = [
  { id: 1, name: 'OOC检查', desc: '角色行为是否符合已建立的性格和能力' },
  { id: 2, name: '时间线检查', desc: '时间逻辑是否自洽，是否存在矛盾' },
  { id: 3, name: '设定冲突', desc: '是否与已有世界观设定或前文矛盾' },
  { id: 4, name: '伏笔检查', desc: '伏笔是否合理推进或回收，是否有遗忘的重要伏笔' },
  { id: 5, name: '节奏检查', desc: '场景类型和情绪基调是否连续重复' },
  { id: 6, name: '文风检查', desc: '是否出现 AI 套话、分析式语言、公式化转折' },
  { id: 7, name: '信息越界', desc: '角色是否知道不该知道的信息' },
  { id: 8, name: '词汇疲劳', desc: '高频词、转折标记词、相同句式是否过度重复' },
  { id: 9, name: '台词失真', desc: '对话是否自然，是否符合角色身份' },
  { id: 10, name: '流水账', desc: '是否缺乏戏剧张力，事件罗列而非叙事' },
  { id: 11, name: '视角一致性', desc: 'POV 是否跳跃，是否出现不该出现的全知叙述' },
  { id: 12, name: '套话检测', desc: '是否有 AI 写作痕迹：不禁、宛如、仿佛、然而、就在这时等' },
  { id: 13, name: '公式化转折', desc: '转折是否可预测，是否缺乏铺垫' },
  { id: 14, name: '支线停滞', desc: '副线是否被遗忘，支线角色是否降级为工具人' },
  { id: 15, name: '利益链断裂', desc: '角色动机是否合理，行为是否有内在逻辑' },
  { id: 16, name: '读者期待管理', desc: '是否满足前文建立的叙事承诺' },
]

const AUDIT_SYSTEM_PROMPT = `你是一位严格的小说质量审计员。审查给定的章节内容，从以下 16 个维度检查质量问题。

${AUDIT_DIMENSIONS.map(d => `${d.id}. ${d.name}：${d.desc}`).join('\n')}

审查规则：
- 只报告实际存在的问题，不要为每个维度强行找问题
- severity 必须是 "critical"（严重影响阅读体验）、"warning"（值得改进）或 "info"（微小建议）
- 评分 0-100，100 表示完美
- 只有当存在 critical 问题时才判定为未通过

输出必须是严格的 JSON，不要输出任何其他内容。

输出格式：
{
  "passed": true/false,
  "issues": [{"severity": "critical|warning|info", "category": "维度名", "description": "问题描述", "suggestion": "修改建议"}],
  "scores": {"维度名": 分数}
}`

/**
 * Auditor Agent — 16 维度质量审查
 * 一次 LLM 调用，temperature=0 确保严格审查
 */
export async function runAuditor(
  provider: AIProvider,
  chapterTitle: string,
  chapterContent: string,
  previousChapterContent: string | undefined,
  memoryContext: MemoryContext | undefined,
): Promise<AuditResult> {
  let userPrompt = `请审查以下第章节内容。\n\n标题：${chapterTitle}\n\n内容：\n${chapterContent}`

  if (previousChapterContent) {
    const prevTail = previousChapterContent.slice(-800)
    userPrompt += `\n\n上一章末尾（供连贯性检查参考）：\n${prevTail}`
  }

  if (memoryContext?.characters) {
    userPrompt += `\n\n角色状态：\n${memoryContext.characters}`
  }

  if (memoryContext?.foreshadowing) {
    userPrompt += `\n\n伏笔池：\n${memoryContext.foreshadowing}`
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: AUDIT_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]

  let rawOutput = ''
  for await (const chunk of provider.generateStream(messages)) {
    rawOutput += chunk
  }

  const jsonStr = extractJson(rawOutput)
  try {
    const parsed = JSON.parse(jsonStr)
    return normalizeAuditResult(parsed)
  } catch {
    // 解析失败时默认通过（不阻止生成流程）
    return { passed: true, issues: [], scores: {} }
  }
}

function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (match) return match[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1)
  }
  return text.trim()
}

function normalizeAuditResult(raw: Record<string, unknown>): AuditResult {
  const issues: AuditIssue[] = Array.isArray(raw.issues)
    ? raw.issues.map((i: Record<string, unknown>) => ({
        severity: (i.severity === 'critical' || i.severity === 'warning' || i.severity === 'info')
          ? i.severity
          : 'info' as const,
        category: String(i.category ?? ''),
        description: String(i.description ?? ''),
        suggestion: String(i.suggestion ?? ''),
      }))
    : []

  return {
    passed: typeof raw.passed === 'boolean' ? raw.passed : issues.every(i => i.severity !== 'critical'),
    issues,
    scores: typeof raw.scores === 'object' && raw.scores !== null
      ? raw.scores as Record<string, number>
      : {},
  }
}
