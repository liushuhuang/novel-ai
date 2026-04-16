import type { ProviderConfig } from '@/types/ai'
import type { AIProvider } from './base'
import { OpenAICompatibleProvider } from './openai-compatible'
import { ClaudeProvider } from './claude'
import { GeminiProvider } from './gemini'
import { CustomProvider } from './custom'

export function createAIProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config.baseUrl, config.apiKey, config.model)
    case 'claude':
      return new ClaudeProvider(config.apiKey, config.model)
    case 'gemini':
      return new GeminiProvider(config.apiKey, config.model)
    case 'custom':
      return new CustomProvider(config.baseUrl, config.apiKey, config.model)
    default:
      throw new Error(`Unknown provider type: ${config.type}`)
  }
}
