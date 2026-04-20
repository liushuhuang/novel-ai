import type { ToolDefinition, StreamEvent } from '@/lib/agent/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: Array<{ id: string; name: string; arguments: string }>
  toolCallId?: string
}

export interface AIProvider {
  generateStream(messages: ChatMessage[]): AsyncIterable<string>
  generateStreamWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
  ): AsyncIterable<StreamEvent>
  testConnection(): Promise<boolean>
}

export interface ProviderConfig {
  baseUrl: string
  apiKey: string
  model: string
  type: string
}
