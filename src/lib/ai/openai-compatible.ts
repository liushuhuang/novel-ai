import OpenAI from 'openai'
import type { ChatMessage, AIProvider } from './base'
import type { ToolDefinition, StreamEvent } from '@/lib/agent/types'

export class OpenAICompatibleProvider implements AIProvider {
  private client: OpenAI
  private model: string

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      defaultHeaders: {
        'User-Agent': 'novel-ai/1.0',
      },
      defaultQuery: {},
    })
    this.model = model
  }

  async *generateStream(messages: ChatMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages.map(m => ({ role: m.role as any, content: m.content })),
      stream: true,
    })
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) yield content
    }
  }

  async *generateStreamWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
  ): AsyncIterable<StreamEvent> {
    const openaiTools = tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))

    const openaiMessages = messages.map(m => {
      if (m.role === 'tool' && m.toolCallId) {
        return {
          role: 'tool' as const,
          tool_call_id: m.toolCallId,
          content: m.content,
        }
      }
      if (m.toolCalls) {
        return {
          role: 'assistant' as const,
          content: m.content,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        }
      }
      return {
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }
    })

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      tools: openaiTools,
      stream: true,
    })

    const pendingToolCalls = new Map<
      number,
      { id: string; name: string; arguments: string }
    >()

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (!delta) continue

      if (delta.content) {
        yield { type: 'text', content: delta.content }
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = tc.index
          if (!pendingToolCalls.has(index)) {
            pendingToolCalls.set(index, {
              id: tc.id ?? '',
              name: tc.function?.name ?? '',
              arguments: '',
            })
          }
          const pending = pendingToolCalls.get(index)!
          if (tc.id) pending.id = tc.id
          if (tc.function?.name) pending.name = tc.function.name
          if (tc.function?.arguments)
            pending.arguments += tc.function.arguments
        }
      }

      if (chunk.choices[0]?.finish_reason === 'tool_calls') {
        for (const [, tc] of pendingToolCalls) {
          yield {
            type: 'tool_call',
            toolCall: {
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            },
          }
        }
        pendingToolCalls.clear()
      }
    }
  }

  async testConnection(): Promise<boolean> {
    await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: 'Say OK' }],
      max_tokens: 5,
    })
    return true
  }
}
