import type { ChatMessage, AIProvider } from './base'
import type { ToolDefinition, StreamEvent } from '@/lib/agent/types'

export class CustomProvider implements AIProvider {
  private baseUrl: string
  private apiKey: string
  private model: string

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
    this.model = model
  }

  async *generateStream(messages: ChatMessage[]): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Custom provider request failed: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // skip malformed chunks
        }
      }
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
          role: 'tool',
          tool_call_id: m.toolCallId,
          content: m.content,
        }
      }
      if (m.toolCalls) {
        return {
          role: 'assistant',
          content: m.content,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        }
      }
      return { role: m.role, content: m.content }
    })

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: openaiMessages,
        tools: openaiTools,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Custom provider request failed: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    const pendingToolCalls = new Map<
      number,
      { id: string; name: string; arguments: string }
    >()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta
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

          if (parsed.choices?.[0]?.finish_reason === 'tool_calls') {
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
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  async testConnection(): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5,
      }),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status}: ${body || response.statusText}`)
    }
    return true
  }
}
