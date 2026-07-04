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
  /** Extra attempts after a retryable failure (network error, timeout, 429, 5xx). Defaults to 2. */
  maxRetries?: number
  /**
   * Gemini-only: caps internal "thinking" tokens, which otherwise eat into `maxTokens`
   * silently and can truncate the actual answer on 2.5 models. Pass 0 to disable
   * thinking entirely (recommended for plain extraction/JSON tasks). Ignored by
   * other providers. Leave unset to keep the provider's own default behavior.
   */
  thinkingBudget?: number
}
