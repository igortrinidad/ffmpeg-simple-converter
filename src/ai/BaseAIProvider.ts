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
  public maxRetries: number
  public thinkingBudget?: number
  public response: any = null
  public result: string = ''
  /** Set by `extractTextFromResponse()` when the provider reports the answer was cut off by `maxTokens` */
  public truncated: boolean = false

  protected messages: AIMessage[] = []

  constructor(options: AIProviderOptions) {
    this.apiKey = options.apiKey
    this.model = options.model
    this.temperature = options.temperature ?? 0.2
    this.maxTokens = options.maxTokens ?? 4096
    this.timeout = options.timeout ?? 120000
    this.maxRetries = options.maxRetries ?? 2
    this.thinkingBudget = options.thinkingBudget
  }

  protected abstract get axiosInstance(): AxiosInstance
  protected abstract invokeLLM(): Promise<void>
  protected abstract extractTextFromResponse(): string

  /**
   * Whether a failed call is worth retrying: network-level failures (no response
   * received), rate limiting (429) and server errors (5xx). Anything else (bad
   * request, auth, invalid model) fails the same way every time, so retrying
   * would just waste time.
   */
  private isRetryableError(error: any): boolean {
    const status = error?.response?.status
    if (status === 429 || (typeof status === 'number' && status >= 500)) return true
    if (error?.response) return false
    return !!error?.request || ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'].includes(error?.code)
  }

  /**
   * Sends the messages to the provider and returns the raw text response.
   * Retries on transient failures with exponential backoff (1s, 2s, 4s, ...)
   * up to `maxRetries` extra attempts.
   */
  public async run(messages: AIMessage[]): Promise<string> {
    this.messages = messages.filter((message) => message.content && message.content.trim().length > 0)
    this.truncated = false

    let lastError: any
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.invokeLLM()
        this.result = this.extractTextFromResponse()
        return this.result
      } catch (error: any) {
        lastError = error
        if (attempt === this.maxRetries || !this.isRetryableError(error)) break

        const delayMs = 1000 * 2 ** attempt
        console.warn(
          `⚠️ ${this.constructor.name} (${this.model}) falhou (tentativa ${attempt + 1}/${this.maxRetries + 1}), tentando novamente em ${delayMs}ms...`
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    const providerMessage =
      lastError?.response?.data?.error?.message || lastError?.response?.data?.error || lastError?.message
    throw new Error(`${this.constructor.name} (${this.model}): ${providerMessage}`)
  }

  /**
   * Sends the messages and parses the response as JSON, tolerating markdown
   * code fences or leading/trailing text around the JSON payload.
   *
   * If the response gets cut off by `maxTokens` and nothing usable could even be
   * salvaged from the partial JSON (see `truncatedArrayRepairParse`), doubles
   * `maxTokens` and tries again — up to 2 extra attempts — before giving up.
   * Verbose prompts (e.g. asking for several long, detailed items per response)
   * can need well more than the default budget, and this adapts to that instead
   * of forcing every caller to guess the right `maxTokens` upfront.
   */
  public async runJSON<T = any>(messages: AIMessage[]): Promise<T> {
    const maxTruncationRetries = 2

    for (let attempt = 0; attempt <= maxTruncationRetries; attempt++) {
      const content = await this.run(messages)
      try {
        return this.parseJSONResult(content)
      } catch (error: any) {
        if (!this.truncated || attempt === maxTruncationRetries) throw error

        this.maxTokens *= 2
        console.warn(
          `⚠️ ${this.constructor.name} (${this.model}): resposta truncada e nada pôde ser recuperado, tentando novamente com maxTokens=${this.maxTokens}...`
        )
      }
    }

    // Unreachable: the loop above always either returns or throws.
    throw new Error(`${this.constructor.name} (${this.model}): falha ao gerar resposta JSON`)
  }

  public parseJSONResult(content: string): any {
    const parsers = [
      this.simpleParse,
      this.codeBlockParse,
      this.braceSliceParse,
      this.truncatedArrayRepairParse
    ]

    for (const parser of parsers) {
      const result = parser.call(this, content)
      if (result !== null) return result
    }

    const truncationHint = this.truncated
      ? ` A resposta foi cortada por atingir o limite de maxTokens (${this.maxTokens}) antes de terminar o JSON — aumente maxTokens.`
      : ''
    throw new Error(
      `Não foi possível interpretar a resposta JSON do modelo (${this.model}):${truncationHint} ${content.slice(0, 500)}`
    )
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

  /**
   * Last-resort recovery for a response cut off mid-array by hitting `maxTokens`
   * (see the `finishReason`/`stop_reason`/`finish_reason` checks in each provider):
   * drops whatever incomplete trailing object was still being written and closes
   * the array off after the last one that DID complete, so at least the items
   * generated before the cut aren't thrown away entirely.
   */
  private truncatedArrayRepairParse(content: string) {
    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim()

      const arrayStart = cleaned.indexOf('[')
      if (arrayStart === -1) return null

      const lastObjectEnd = cleaned.lastIndexOf('}')
      if (lastObjectEnd === -1 || lastObjectEnd <= arrayStart) return null

      const repaired = JSON.parse(`${cleaned.slice(arrayStart, lastObjectEnd + 1)}]`)
      console.warn(
        `⚠️ ${this.constructor.name} (${this.model}): resposta truncada (limite de maxTokens=${this.maxTokens}) — recuperados ${Array.isArray(repaired) ? repaired.length : 0} item(ns) gerado(s) antes do corte.`
      )
      return repaired
    } catch {
      return null
    }
  }
}
