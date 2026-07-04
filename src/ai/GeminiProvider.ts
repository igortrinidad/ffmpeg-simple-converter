import axios, { type AxiosInstance } from 'axios'
import { BaseAIProvider } from './BaseAIProvider.js'

/**
 * models: https://ai.google.dev/gemini-api/docs/models
 * pricing: https://ai.google.dev/gemini-api/docs/pricing
 */
export class GeminiProvider extends BaseAIProvider {
  protected get axiosInstance(): AxiosInstance {
    return axios.create({
      timeout: this.timeout,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  private get endpointUrl(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`
  }

  protected async invokeLLM(): Promise<void> {
    const systemMessage = this.messages.find((message) => message.role === 'system')
    const contents = this.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }))

    const { data } = await this.axiosInstance.post(this.endpointUrl, {
      ...(systemMessage ? { systemInstruction: { parts: [{ text: systemMessage.content }] } } : {}),
      contents: contents.length ? contents : [{ role: 'user', parts: [{ text: '' }] }],
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxTokens
      }
    })

    this.response = data
  }

  protected extractTextFromResponse(): string {
    const text = this.response?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text || '')
      .join('\n')

    if (!text) {
      throw new Error('Resposta vazia da Gemini')
    }
    return text.trim()
  }
}
