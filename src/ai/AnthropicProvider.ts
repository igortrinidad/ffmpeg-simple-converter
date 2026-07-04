import axios, { type AxiosInstance } from 'axios'
import { BaseAIProvider } from './BaseAIProvider.js'

/**
 * models: https://docs.anthropic.com/en/docs/about-claude/models
 * pricing: https://www.anthropic.com/pricing
 */
export class AnthropicProvider extends BaseAIProvider {
  protected get axiosInstance(): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.anthropic.com/v1',
      timeout: this.timeout,
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    })
  }

  protected async invokeLLM(): Promise<void> {
    const systemMessage = this.messages.find((message) => message.role === 'system')
    const conversationMessages = this.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content }))

    const { data } = await this.axiosInstance.post('/messages', {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      ...(systemMessage ? { system: systemMessage.content } : {}),
      messages: conversationMessages.length ? conversationMessages : [{ role: 'user', content: '' }]
    })

    this.response = data
  }

  protected extractTextFromResponse(): string {
    const content = this.response?.content
    if (!Array.isArray(content) || !content.length) {
      throw new Error('Resposta vazia da Anthropic')
    }
    return content.map((block: any) => block.text || '').join('\n').trim()
  }
}
