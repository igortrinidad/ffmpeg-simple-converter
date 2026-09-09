import { AnthropicProvider } from './AnthropicProvider.js'
import { GeminiProvider } from './GeminiProvider.js'
import { OpenRouterProvider } from './OpenRouterProvider.js'
import { OpenAIProvider } from './OpenAIProvider.js'
import { GroqProvider } from './GroqProvider.js'
import { BaseAIProvider } from './BaseAIProvider.js'
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js'
import type { AIProviderName, AIProviderOptions } from './types.js'

export function createAIProvider(provider: AIProviderName, options: AIProviderOptions): BaseAIProvider {
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(options)
    case 'gemini':
      return new GeminiProvider(options)
    case 'openrouter':
      return new OpenRouterProvider(options)
    case 'openai':
      return new OpenAIProvider(options)
    case 'groq':
      return new GroqProvider(options)
    default:
      throw new Error(`Provedor de IA não suportado: ${provider}`)
  }
}

export {
  BaseAIProvider,
  OpenAICompatibleProvider,
  AnthropicProvider,
  GeminiProvider,
  OpenRouterProvider,
  OpenAIProvider,
  GroqProvider
}
export * from './types.js'
export * from './models.js'
