import OpenAI from 'openai'
import type { ChatMessage, AIProvider } from './base'

export class OpenAICompatibleProvider implements AIProvider {
  private client: OpenAI
  private model: string

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl })
    this.model = model
  }

  async *generateStream(messages: ChatMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    })
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) yield content
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5,
      })
      return true
    } catch {
      return false
    }
  }
}
