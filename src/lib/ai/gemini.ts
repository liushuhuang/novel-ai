import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ChatMessage, AIProvider } from './base'

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

  async testConnection(): Promise<boolean> {
    try {
      const genModel = this.client.getGenerativeModel({ model: this.model })
      await genModel.generateContent('Say OK')
      return true
    } catch {
      return false
    }
  }
}
