import type { AIProviderName } from './types.js'

/**
 * Curated list of accepted models per provider. Kept intentionally small —
 * pick the current flagship/fast/cheap tiers instead of mirroring every
 * model a provider exposes, since these lists go straight into CLI prompts.
 */
export const ANTHROPIC_MODELS = [
  'claude-opus-4-8',
  'claude-sonnet-5',
  'claude-haiku-4-5-20251001',
  'claude-fable-5'
] as const

export const GEMINI_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview'
] as const

export const OPENROUTER_MODELS = [
  'anthropic/claude-sonnet-4.5',
  'google/gemini-2.5-flash',
  'openai/gpt-4o-mini',
  'deepseek/deepseek-chat',
  'meta-llama/llama-3.3-70b-instruct'
] as const

export const OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini'
] as const

export const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct'
] as const

export type AnthropicModel = typeof ANTHROPIC_MODELS[number]
export type GeminiModel = typeof GEMINI_MODELS[number]
export type OpenRouterModel = typeof OPENROUTER_MODELS[number]
export type OpenAIModel = typeof OPENAI_MODELS[number]
export type GroqModel = typeof GROQ_MODELS[number]
export type AIModel = AnthropicModel | GeminiModel | OpenRouterModel | OpenAIModel | GroqModel

export const AI_MODELS_BY_PROVIDER: Record<AIProviderName, readonly string[]> = {
  anthropic: ANTHROPIC_MODELS,
  gemini: GEMINI_MODELS,
  openrouter: OPENROUTER_MODELS,
  openai: OPENAI_MODELS,
  groq: GROQ_MODELS
}

export const AI_PROVIDER_LABELS: Record<AIProviderName, string> = {
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google (Gemini)',
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  groq: 'Groq'
}
