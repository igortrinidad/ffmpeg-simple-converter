<script setup lang="ts">
import type { ThemePreference } from '@shared/types'
import { useTheme, THEME_OPTIONS } from '../../../composables/useTheme'

const emit = defineEmits<{
  back: []
}>()

const { state: theme, setTheme } = useTheme()

async function select(preference: ThemePreference): Promise<void> {
  if (preference === theme.preference) return
  await setTheme(preference)
}
</script>

<template>
  <div class="appearance-view">
    <header class="view-header">
      <button class="btn btn-ghost" @click="emit('back')">← Voltar</button>
      <h2>Aparência</h2>
    </header>

    <p class="hint">O tema é aplicado na hora e fica salvo para as próximas aberturas do app.</p>

    <ul class="theme-list">
      <li
        v-for="option in THEME_OPTIONS"
        :key="option.id"
        class="theme-row card"
        :class="{ selected: theme.preference === option.id }"
        @click="select(option.id)"
      >
        <span class="row-icon">{{ option.icon }}</span>
        <div class="row-text">
          <div class="row-label">{{ option.label }}</div>
          <div class="row-description">{{ option.description }}</div>
        </div>
        <span class="row-check">{{ theme.preference === option.id ? '✓' : '' }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.appearance-view {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.view-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.view-header h2 {
  font-size: 16px;
  margin: 0;
}

.hint {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0;
}

.theme-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.theme-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
}

.theme-row:hover {
  border-color: var(--accent);
}

.theme-row.selected {
  border-color: var(--accent);
}

.row-icon {
  font-size: 20px;
}

.row-text {
  flex: 1;
}

.row-label {
  font-weight: 600;
  font-size: 14px;
}

.row-description {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 2px;
}

.row-check {
  color: var(--accent);
  font-size: 16px;
  font-weight: 700;
}
</style>
