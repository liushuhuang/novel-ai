export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIProvider {
  generateStream(messages: ChatMessage[]): AsyncIterable<string>
  testConnection(): Promise<boolean>
}

export interface ProviderConfig {
  baseUrl: string
  apiKey: string
  model: string
  type: string
}
