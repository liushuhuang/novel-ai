export const PROVIDER_TYPES = [
  { value: 'openai-compatible', label: 'OpenAI 兼容' },
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'gemini', label: 'Gemini (Google)' },
  { value: 'custom', label: '自定义' },
] as const

export type ProviderType = (typeof PROVIDER_TYPES)[number]['value']
