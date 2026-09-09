import { reactive, readonly } from 'vue'
import type { ThemePreference } from '@shared/types'

export const THEME_OPTIONS: { id: ThemePreference; icon: string; label: string; description: string }[] = [
  { id: 'system', icon: '🖥️', label: 'Sistema', description: 'Segue o tema do sistema operacional' },
  { id: 'light', icon: '☀️', label: 'Claro', description: 'Sempre no tema claro' },
  { id: 'dark', icon: '🌙', label: 'Escuro', description: 'Sempre no tema escuro' }
]

const state = reactive({
  preference: 'system' as ThemePreference
})

/**
 * Stamps (or clears) `data-theme` on <html>. With `system` no attribute is set,
 * so style.css falls back to the `prefers-color-scheme` media query.
 */
function apply(preference: ThemePreference): void {
  const root = document.documentElement
  if (preference === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', preference)
  }
  state.preference = preference
}

/** Applies the stored preference. Called once on startup, before the app mounts. */
async function init(): Promise<void> {
  try {
    const config = await window.api.config.get()
    apply(config.theme ?? 'system')
  } catch {
    apply('system')
  }
}

/** Applies the preference immediately and persists it. */
async function setTheme(preference: ThemePreference): Promise<void> {
  apply(preference)
  await window.api.config.save({ theme: preference })
}

export function useTheme() {
  return { state: readonly(state), init, setTheme }
}
