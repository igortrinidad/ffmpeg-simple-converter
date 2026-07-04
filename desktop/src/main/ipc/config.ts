import { ipcMain } from 'electron'
import { getStoredConfig, saveStoredConfig, getConfigDirectory, AI_MODELS_BY_PROVIDER, AI_PROVIDER_LABELS } from 'mediacript'
import type { AIProviderName, AIProviderOption, Config } from '../../shared/types'

export function registerConfigIpc(): void {
  ipcMain.handle('config:get', (): Config => {
    return getStoredConfig()
  })

  ipcMain.handle('config:save', (_event, values: Partial<Config>): Config => {
    return saveStoredConfig(values)
  })

  ipcMain.handle('config:getConfigDir', (): string => {
    return getConfigDirectory()
  })

  ipcMain.handle('config:listAIProviders', (): AIProviderOption[] => {
    const config = getStoredConfig()
    const configKeyByProvider: Record<AIProviderName, keyof Config> = {
      anthropic: 'anthropicApiKey',
      gemini: 'geminiApiKey',
      openrouter: 'openrouterApiKey',
      openai: 'openaiApiKey',
      groq: 'groqApiKey'
    }

    return (Object.keys(AI_PROVIDER_LABELS) as AIProviderName[]).map((provider) => ({
      provider,
      label: AI_PROVIDER_LABELS[provider],
      models: [...AI_MODELS_BY_PROVIDER[provider]],
      hasApiKey: !!config[configKeyByProvider[provider]]
    }))
  })
}
