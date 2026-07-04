import { ALL_API_KEY_PROVIDERS, type ApiKeyConfigKey } from '../config/index.js'
import type { Config } from '../types/index.js'
import { runWizard, type WizardStep } from './wizard.js'

/**
 * Wizard-based version of `promptApiKeys` (src/config/index.ts), used only by
 * the interactive CLI (src/index.ts). First asks which provider(s) to
 * configure (checkbox), then iterates over just the selected ones asking for
 * each key one at a time. Left arrow (or Escape while typing a key) goes back
 * to the previous step; right arrow re-applies a previous answer to advance
 * forward again.
 * @param existingConfig - Current config, used to pre-check already configured
 *   providers and prefill their key as the default.
 */
export async function promptApiKeysWizard(existingConfig: Config = {}): Promise<Config> {
  console.log('\n🔑 Configuração de API Keys\n')

  const answers = await runWizard<{ selectedProviders: ApiKeyConfigKey[]; [key: string]: any }>((current) => {
    const steps: WizardStep[] = [
      {
        id: 'selectedProviders',
        type: 'checkbox',
        message: 'Quais provedores você deseja configurar agora?',
        choices: ALL_API_KEY_PROVIDERS.map((provider) => ({
          name: `${provider.label}${existingConfig[provider.configKey] ? ' — já configurado' : ''}`,
          value: provider.configKey
        })),
        default: ALL_API_KEY_PROVIDERS
          .filter((provider) => !!existingConfig[provider.configKey])
          .map((provider) => provider.configKey)
      }
    ]

    if (!('selectedProviders' in current)) return steps

    for (const configKey of (current.selectedProviders || []) as ApiKeyConfigKey[]) {
      const provider = ALL_API_KEY_PROVIDERS.find((p) => p.configKey === configKey)!
      steps.push({
        id: `key:${configKey}`,
        type: 'input',
        message: `${provider.label} — API Key:`,
        default: existingConfig[configKey] || ''
      })
    }

    return steps
  })

  const config: Config = {}

  for (const configKey of answers.selectedProviders || []) {
    const apiKey = answers[`key:${configKey}`]
    if (typeof apiKey === 'string' && apiKey.trim()) {
      config[configKey] = apiKey.trim()
    }
  }

  return config
}
