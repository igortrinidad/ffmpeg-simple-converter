export type AIProviderName = 'anthropic' | 'gemini' | 'openrouter' | 'openai' | 'groq'

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIProviderOptions {
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
  timeout?: number
}
