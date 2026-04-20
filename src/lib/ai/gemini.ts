import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ChatMessage, AIProvider } from './base'
import type { ToolDefinition, StreamEvent } from '@/lib/agent/types'

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenerativeAI(apiKey)
    this.model = model
  }

  async *generateStream(messages: ChatMessage[]): AsyncIterable<string> {
    const genModel = this.client.getGenerativeModel({ model: this.model })
    const systemMsg = messages.find(m => m.role === 'system')
    const nonSystemMsgs = messages.filter(m => m.role !== 'system')

    const contents = nonSystemMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const result = await genModel.generateContentStream({
      contents,
      systemInstruction: systemMsg?.content,
    })

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) yield text
    }
  }

  async *generateStreamWithTools(
    messages: ChatMessage[],
    tools: ToolDefinition[],
  ): AsyncIterable<StreamEvent> {
    const genModel = this.client.getGenerativeModel({
      model: this.model,
      tools: [
        {
          functionDeclarations: tools.map(t => ({
            name: t.name,
            description: t.description,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parameters: t.parameters as any,
          })),
        },
      ],
    })

    const systemMsg = messages.find(m => m.role === 'system')
    const nonSystemMsgs = messages.filter(m => m.role !== 'system')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = nonSystemMsgs.map(m => {
      if (m.role === 'tool' && m.toolCallId) {
        return {
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: m.toolCallId,
                response: { result: m.content },
              },
            },
          ],
        }
      }
      if (m.toolCalls) {
        return {
          role: 'model',
          parts: m.toolCalls.map(tc => ({
            functionCall: {
              name: tc.name,
              args: JSON.parse(tc.arguments || '{}'),
            },
          })),
        }
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }
    })

    const result = await genModel.generateContentStream({
      contents,
      systemInstruction: systemMsg?.content,
    })

    for await (const chunk of result.stream) {
      const text = chunk.text?.()
      if (text) yield { type: 'text', content: text }

      const functionCalls = chunk.functionCalls?.()
      if (functionCalls) {
        for (const fc of functionCalls) {
          yield {
            type: 'tool_call',
            toolCall: {
              id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              name: fc.name,
              arguments: JSON.stringify(fc.args ?? {}),
            },
          }
        }
      }
    }
  }

  async testConnection(): Promise<boolean> {
    const genModel = this.client.getGenerativeModel({ model: this.model })
    await genModel.generateContent('Say OK')
    return true
  }
}
