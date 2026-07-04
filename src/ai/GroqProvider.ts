import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js'

/**
 * models: https://console.groq.com/docs/models
 * pricing: https://groq.com/pricing/
 */
export class GroqProvider extends OpenAICompatibleProvider {
  protected get baseURL(): string {
    return 'https://api.groq.com/openai/v1'
  }

  protected get authHeaders(): Record<string, string> {
    return { 'Authorization': `Bearer ${this.apiKey}` }
  }
}
