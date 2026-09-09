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
        maxOutputTokens: this.maxTokens,
        // Gemini 2.5 models spend part of maxOutputTokens on invisible "thinking"
        // before writing the answer, which can silently eat the whole budget and
        // truncate the actual response. Callers doing plain extraction/JSON tasks
        // (no need for visible reasoning) can pass thinkingBudget: 0 to disable it.
        ...(this.thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget: this.thinkingBudget } } : {})
      }
    })

    this.response = data
  }

  protected extractTextFromResponse(): string {
    const candidate = this.response?.candidates?.[0]
    const text = candidate?.content?.parts?.map((part: any) => part.text || '').join('\n')
    const hitMaxTokens = candidate?.finishReason === 'MAX_TOKENS'

    if (!text) {
      throw new Error(
        hitMaxTokens
          ? `Limite de maxTokens (${this.maxTokens}) atingido antes de gerar qualquer texto (possivelmente consumido pelo "thinking" do modelo). Aumente maxTokens ou defina thinkingBudget: 0.`
          : 'Resposta vazia da Gemini'
      )
    }

    // Don't throw here even though the answer is incomplete — the (partial) text
    // still reaches runJSON, which may be able to salvage the items that did
    // complete before the cut. `this.truncated` just improves the error message
    // if that salvage attempt also fails.
    if (hitMaxTokens) this.truncated = true

    return text.trim()
  }
}
