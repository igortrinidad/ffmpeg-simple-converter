import type { AxiosInstance } from 'axios'
import type { AIMessage, AIProviderOptions } from './types.js'

/**
 * Lightweight port of ola-secretaria's BaseAIProvider pattern: each provider
 * only implements how to build the HTTP client, the request body and how to
 * pull the text out of the response. JSON extraction/parsing (models tend to
 * wrap JSON in markdown fences) lives here so every provider benefits.
 */
export abstract class BaseAIProvider {
  public apiKey: string
  public model: string
  public temperature: number
  public maxTokens: number
  public timeout: number
  public response: any = null
  public result: string = ''

  protected messages: AIMessage[] = []

  constructor(options: AIProviderOptions) {
    this.apiKey = options.apiKey
    this.model = options.model
    this.temperature = options.temperature ?? 0.2
    this.maxTokens = options.maxTokens ?? 4096
    this.timeout = options.timeout ?? 120000
  }

  protected abstract get axiosInstance(): AxiosInstance
  protected abstract invokeLLM(): Promise<void>
  protected abstract extractTextFromResponse(): string

  /**
   * Sends the messages to the provider and returns the raw text response.
   */
  public async run(messages: AIMessage[]): Promise<string> {
    this.messages = messages.filter((message) => message.content && message.content.trim().length > 0)

    try {
      await this.invokeLLM()
      this.result = this.extractTextFromResponse()
      return this.result
    } catch (error: any) {
      const providerMessage = error?.response?.data?.error?.message || error?.response?.data?.error || error?.message
      throw new Error(`${this.constructor.name} (${this.model}): ${providerMessage}`)
    }
  }

  /**
   * Sends the messages and parses the response as JSON, tolerating markdown
   * code fences or leading/trailing text around the JSON payload.
   */
  public async runJSON<T = any>(messages: AIMessage[]): Promise<T> {
    const content = await this.run(messages)
    return this.parseJSONResult(content)
  }

  public parseJSONResult(content: string): any {
    const parsers = [
      this.simpleParse,
      this.codeBlockParse,
      this.braceSliceParse
    ]

    for (const parser of parsers) {
      const result = parser.call(this, content)
      if (result !== null) return result
    }

    throw new Error(`Não foi possível interpretar a resposta JSON do modelo (${this.model}): ${content.slice(0, 500)}`)
  }

  private simpleParse(content: string) {
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  private codeBlockParse(content: string) {
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim()
      return JSON.parse(cleaned)
    } catch {
      return null
    }
  }

  private braceSliceParse(content: string) {
    try {
      const start = content.search(/[[{]/)
      const end = Math.max(content.lastIndexOf('}'), content.lastIndexOf(']'))
      if (start === -1 || end === -1 || end < start) return null
      return JSON.parse(content.slice(start, end + 1))
    } catch {
      return null
    }
  }
}
