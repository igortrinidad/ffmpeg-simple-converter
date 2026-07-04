import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js'

/**
 * models: https://openrouter.ai/models
 * pricing: https://openrouter.ai/docs#pricing
 */
export class OpenRouterProvider extends OpenAICompatibleProvider {
  protected get baseURL(): string {
    return 'https://openrouter.ai/api/v1'
  }

  protected get authHeaders(): Record<string, string> {
    return { 'Authorization': `Bearer ${this.apiKey}` }
  }
}
