import type { AIProvider, ChatMessage } from '@/types/ai'
import type { ToolDefinition, StreamEvent, AgentLoopConfig } from './types'
import { executeTool, type ToolExecutionContext } from './executor'

export interface AgentLoopResult {
  /** 最终文本（write_chapter 的内容或 LLM 的最后文本回复） */
  finalContent: string
  /** 是否通过 write_chapter 工具保存 */
  usedWriteTool: boolean
}

/**
 * Agent 核心循环
 *
 * 借鉴 novel-bot 的 while-loop 和 inkos 的 runAgentLoop：
 * 1. 向 LLM 发送 messages + tools
 * 2. 如果 LLM 返回 tool_call → 执行工具 → 追加结果 → 循环
 * 3. 如果 LLM 返回纯文本 → loop 结束
 * 4. 达到 maxTurns 强制结束
 */
export async function runAgentLoop(
  provider: AIProvider,
  systemPrompt: string,
  tools: ToolDefinition[],
  context: ToolExecutionContext,
  config: AgentLoopConfig,
): Promise<AgentLoopResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildInitialUserPrompt(context.chapterNumber) },
  ]

  let finalContent = ''
  let usedWriteTool = false
  let turnCount = 0
  const MAX_CONTEXT_MESSAGES = 10

  while (turnCount < config.maxTurns) {
    turnCount++

    // Collect all events from this turn
    const events: StreamEvent[] = []
    for await (const event of provider.generateStreamWithTools(
      messages,
      tools,
    )) {
      events.push(event)

      if (event.type === 'text') {
        config.onStreamText?.(event.content)
      } else if (event.type === 'tool_call') {
        config.onToolCall?.(event.toolCall.name, event.toolCall.arguments)
      }
    }

    // Classify events
    const textParts: string[] = []
    const toolCalls: Extract<StreamEvent, { type: 'tool_call' }>[] = []

    for (const event of events) {
      if (event.type === 'text') textParts.push(event.content)
      if (event.type === 'tool_call') toolCalls.push(event)
    }

    // No tool calls = LLM didn't use tools. Force it to use write_chapter.
    if (toolCalls.length === 0) {
      const textSoFar = textParts.join('')
      if (textSoFar && textSoFar.length > 200) {
        // LLM wrote the chapter as plain text. Treat it as the final content.
        finalContent = textSoFar
        break
      }
      // LLM output something short (like a plan/summary). Remind it to use tools.
      messages.push({
        role: 'user',
        content: '你没有使用工具。请立即调用 write_chapter 工具提交你的章节内容。不要输出任何解释或计划，直接调用工具。',
      })
      continue
    }

    // Append assistant message with tool_calls
    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: textParts.join(''),
      toolCalls: toolCalls.map(tc => ({
        id: tc.toolCall.id,
        name: tc.toolCall.name,
        arguments: tc.toolCall.arguments,
      })),
    }
    messages.push(assistantMsg)

    // Execute each tool call
    for (const tc of toolCalls) {
      let result: string
      try {
        const parsedArgs = JSON.parse(tc.toolCall.arguments || '{}')
        result = await executeTool(tc.toolCall.name, parsedArgs, context)
      } catch (e) {
        result = `工具执行错误: ${e instanceof Error ? e.message : String(e)}`
      }

      // If write_chapter succeeded, capture the content
      if (tc.toolCall.name === 'write_chapter' && !result.startsWith('错误')) {
        usedWriteTool = true
        try {
          finalContent =
            JSON.parse(tc.toolCall.arguments || '{}').content ?? ''
        } catch {
          finalContent = tc.toolCall.arguments
        }
      }

      config.onToolResult?.(tc.toolCall.name, result)

      messages.push({
        role: 'tool',
        content: compactToolResult(tc.toolCall.name, result),
        toolCallId: tc.toolCall.id,
      })
    }

    // Context compaction: keep messages within budget
    compactMessages(messages, MAX_CONTEXT_MESSAGES)
  }

  // If we hit maxTurns without a final text response, get one without tools
  if (turnCount >= config.maxTurns && !finalContent) {
    let lastText = ''
    for await (const event of provider.generateStreamWithTools(
      messages,
      [], // no tools - force text response
    )) {
      if (event.type === 'text') {
        lastText += event.content
        config.onStreamText?.(event.content)
      }
    }
    finalContent = lastText
  }

  return { finalContent, usedWriteTool }
}

function buildInitialUserPrompt(chapterNumber: number): string {
  if (chapterNumber === 1) {
    return `现在开始创作第1章。直接创作完整的小说正文，完成后调用 write_chapter 工具保存。不要输出计划或摘要。`
  }
  return `现在开始创作第${chapterNumber}章。如需回顾前文，可调用 read_chapter。创作完成后调用 write_chapter 工具保存。不要输出计划或摘要。`
}

/**
 * Compact tool results to reduce context size.
 * Similar to novel-bot's compaction strategy.
 */
function compactToolResult(name: string, result: string): string {
  if (name === 'read_memory') {
    // Memory results can be very long - keep them as-is since they're important
    return result
  }
  if (name === 'read_chapter') {
    // Chapter content can be long - truncate if needed
    if (result.length > 3000) {
      return (
        result.slice(0, 1500) +
        '\n\n[... 中间内容已省略 ...]\n\n' +
        result.slice(-1500)
      )
    }
    return result
  }
  return result
}

/**
 * Keep message list within a max length by compacting older messages.
 * System message is always kept. Older messages get summarized.
 */
function compactMessages(messages: ChatMessage[], max: number): void {
  if (messages.length <= max) return

  const systemMsg = messages[0]
  const omitted = messages.length - (max - 1)
  const recentMessages = messages.slice(-(max - 1))

  messages.length = 0
  messages.push(systemMsg)

  if (omitted > 0) {
    messages.push({
      role: 'user',
      content: `[前 ${omitted} 条消息已省略]`,
    })
  }

  messages.push(...recentMessages)
}
