import axios, { type AxiosInstance } from 'axios'
import { BaseAIProvider } from './BaseAIProvider.js'

/**
 * Shared implementation for providers that expose an OpenAI-compatible
 * `/chat/completions` endpoint (OpenAI itself, Groq, OpenRouter, ...).
 * Subclasses only need to provide the base URL and auth headers.
 */
export abstract class OpenAICompatibleProvider extends BaseAIProvider {
  protected abstract get baseURL(): string
  protected abstract get authHeaders(): Record<string, string>

  protected get axiosInstance(): AxiosInstance {
    return axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders
      }
    })
  }

  protected async invokeLLM(): Promise<void> {
    const { data } = await this.axiosInstance.post('/chat/completions', {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: this.messages.map((message) => ({ role: message.role, content: message.content }))
    })

    this.response = data
  }

  protected extractTextFromResponse(): string {
    const text = this.response?.choices?.[0]?.message?.content
    if (!text) {
      throw new Error(`Resposta vazia da ${this.constructor.name}`)
    }
    return text.trim()
  }
}
