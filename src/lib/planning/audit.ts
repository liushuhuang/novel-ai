import type { AIProvider, ChatMessage } from '@/types/ai'
import type { MemoryContext } from '@/lib/memory/types'

export interface AuditResult {
  passed: boolean
  issues: AuditIssue[]
  summary: string
}

export interface AuditIssue {
  severity: 'critical' | 'warning' | 'info'
  category: string
  description: string
  suggestion: string
}

const AUDIT_SYSTEM_PROMPT = `你是一位严格的小说审稿编辑。请从以下维度审查章节内容，发现矛盾和问题：

1. **连贯性检查**：与上一章的衔接是否自然？时间线是否连续？场景跳跃是否有交代？
2. **角色一致性**：角色行为是否符合既定人设？有没有突然的性格转变？
3. **重复检查**：是否出现了与前文雷同的场景、任务、描写？（特别是晨会、内心OS、特定比喻）
4. **伏笔检查**：已埋伏笔是否被遗忘？已回收伏笔是否被重复使用？
5. **设定冲突**：是否与世界观、背景设定矛盾？
6. **节奏检查**：连续高张力或连续平淡是否超过 3 章？
7. **信息越界**：角色是否知道了他们不应该知道的信息？
8. **套话密度**：AI 痕迹用词（仿佛、忽然、不禁、竟然等）是否过密？每 3000 字不超过 1 次。

请输出 JSON 格式：
{
  "passed": boolean,
  "issues": [{"severity": "critical|warning|info", "category": "维度名", "description": "问题描述", "suggestion": "修复建议"}],
  "summary": "一句话总结"
}

规则：
- 只有 critical 问题才算不通过（passed: false）
- warning 和 info 仅供参考
- 如果没有问题，返回 passed: true, issues: [], summary: "无问题"`

/**
 * 审计刚生成的章节
 * 借鉴 InkOS ContinuityAuditor：用 AI 做多维度审查
 */
export async function auditChapter(
  provider: AIProvider,
  chapterContent: string,
  previousChapterContent: string | null,
  memoryContext?: MemoryContext,
): Promise<AuditResult> {
  const userPrompt = buildAuditPrompt(chapterContent, previousChapterContent, memoryContext)

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: AUDIT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]

    let raw = ''
    for await (const chunk of provider.generateStream(messages)) {
      raw += chunk
    }

    return parseAuditResult(raw)
  } catch (e) {
    console.error('Audit failed:', e)
    return { passed: true, issues: [], summary: '审计失败，默认通过' }
  }
}

function buildAuditPrompt(
  chapterContent: string,
  previousChapterContent: string | null,
  memoryContext?: MemoryContext,
): string {
  const parts: string[] = []

  if (memoryContext) {
    if (memoryContext.characters) {
      parts.push(`## 角色状态\n${memoryContext.characters}`)
    }
    if (memoryContext.openThreads) {
      parts.push(`## 未完结剧情线\n${memoryContext.openThreads}`)
    }
    if (memoryContext.foreshadowing) {
      parts.push(`## 伏笔池\n${memoryContext.foreshadowing}`)
    }
  }

  if (previousChapterContent) {
    parts.push(`## 上一章内容（末尾 500 字）`)
    parts.push(previousChapterContent.slice(-500))
  }

  parts.push(`## 待审章节内容`)
  parts.push(chapterContent.slice(0, 6000))

  return parts.join('\n\n')
}

function parseAuditResult(raw: string): AuditResult {
  try {
    const balanced = extractBalancedJson(raw)
    if (balanced) return JSON.parse(balanced)
  } catch {
    // fallthrough
  }

  try {
    return JSON.parse(raw)
  } catch {
    // fallthrough
  }

  try {
    const codeBlock = raw.match(/```json\s*([\s\S]*?)```/)?.[1]
    if (codeBlock) return JSON.parse(codeBlock)
  } catch {
    // fallthrough
  }

  return { passed: true, issues: [], summary: '审计结果解析失败' }
}

function extractBalancedJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    if (text[i] === '}') depth--
    if (depth === 0) return text.slice(start, i + 1)
  }
  return null
}
