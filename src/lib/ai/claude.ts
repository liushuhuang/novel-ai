import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, AIProvider } from './base'
import type { ToolDefinition, StreamEvent } from '@/lib/agent/types'

export class ClaudeProvider implements AIProvider {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async *generateStream(messages: ChatMessage[]): AsyncIterable<string> {
    const systemMsg = messages.find(m => m.role === 'system')
    const nonSystemMsgs = messages.filter(m => m.role !== 'system')

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8192,
      system: systemMsg?.content ?? '',
      messages: nonSystemMsgs.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }

  async *generateStreamWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
  ): AsyncIterable<StreamEvent> {
    const anthropicTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object' as const,
        properties: t.parameters.properties,
        required: t.parameters.required,
      },
    }))

    const systemMsg = messages.find(m => m.role === 'system')
    const nonSystemMsgs = messages.filter(m => m.role !== 'system')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anthropicMessages: any[] = nonSystemMsgs.map(m => {
      if (m.role === 'tool' && m.toolCallId) {
        return {
          role: 'user' as const,
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: m.toolCallId,
              content: m.content,
            },
          ],
        }
      }
      if (m.toolCalls) {
        return {
          role: 'assistant' as const,
          content: m.toolCalls.map(tc => ({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.name,
            input: JSON.parse(tc.arguments || '{}'),
          })),
        }
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }
    })

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 8192,
      system: systemMsg?.content ?? '',
      messages: anthropicMessages,
      tools: anthropicTools,
    })

    let currentToolId = ''
    let currentToolName = ''
    let currentToolArgs = ''

    for await (const event of stream) {
      if (
        event.type === 'content_block_start' &&
        event.content_block.type === 'tool_use'
      ) {
        currentToolId = event.content_block.id
        currentToolName = event.content_block.name
        currentToolArgs = ''
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text', content: event.delta.text }
        } else if (event.delta.type === 'input_json_delta') {
          currentToolArgs += event.delta.partial_json
        }
      } else if (
        event.type === 'content_block_stop' &&
        currentToolName
      ) {
        yield {
          type: 'tool_call',
          toolCall: {
            id: currentToolId,
            name: currentToolName,
            arguments: currentToolArgs,
          },
        }
        currentToolName = ''
      }
    }
  }

  async testConnection(): Promise<boolean> {
    await this.client.messages.create({
      model: this.model,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Say OK' }],
    })
    return true
  }
}
