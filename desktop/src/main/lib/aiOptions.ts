import { getStoredConfig } from 'mediacript'
import type { HighlightAIOptions } from 'mediacript'

type StoredConfig = ReturnType<typeof getStoredConfig>

export function resolveHighlightApiKey(provider: string, config: StoredConfig): string {
  const key = ({
    anthropic: config.anthropicApiKey,
    gemini: config.geminiApiKey,
    openrouter: config.openrouterApiKey,
    openai: config.openaiApiKey,
    groq: config.groqApiKey
  } as Record<string, string | undefined>)[provider]

  if (!key) {
    throw new Error(`Nenhuma API key configurada para o provedor "${provider}"`)
  }
  return key
}

/**
 * Turns the user's configured fallback list (settings, provider+model only) into
 * ready-to-use AI options (resolving each one's API key). Entries whose provider
 * has no key configured, or that duplicate the primary provider+model already
 * being tried, are skipped rather than failing the whole run.
 */
export function buildHighlightFallbackOptions(
  config: StoredConfig,
  primary: { provider: string; model: string }
): HighlightAIOptions[] {
  const fallbacks = config.highlightFallbackModels ?? []
  const options: HighlightAIOptions[] = []

  for (const fallback of fallbacks) {
    if (fallback.provider === primary.provider && fallback.model === primary.model) continue

    try {
      options.push({
        provider: fallback.provider,
        model: fallback.model,
        apiKey: resolveHighlightApiKey(fallback.provider, config)
      })
    } catch {
      // No API key configured for this fallback provider — skip it instead of failing the run.
    }
  }

  return options
}
