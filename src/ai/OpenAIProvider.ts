import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js'

/**
 * models: https://platform.openai.com/docs/models
 * pricing: https://openai.com/api/pricing
 */
export class OpenAIProvider extends OpenAICompatibleProvider {
  protected get baseURL(): string {
    return 'https://api.openai.com/v1'
  }

  protected get authHeaders(): Record<string, string> {
    return { 'Authorization': `Bearer ${this.apiKey}` }
  }
}
