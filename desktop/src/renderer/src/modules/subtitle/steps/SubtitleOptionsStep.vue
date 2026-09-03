<script setup lang="ts">
import type { SubtitleOptionsInput } from '@shared/types'

const model = defineModel<SubtitleOptionsInput>({ required: true })

const emit = defineEmits<{
  continue: []
}>()

const MODES = [
  {
    id: 'hardsub' as const,
    label: 'Legenda embutida (hardsub)',
    description: 'Gravada nos quadros do vídeo — sempre visível, funciona em qualquer player, mas não pode ser desligada.'
  },
  {
    id: 'softsub' as const,
    label: 'Legenda separada (softsub)',
    description: 'Adicionada como uma faixa de legenda — o espectador pode ligar/desligar, e o vídeo não é recodificado.'
  }
]
</script>

<template>
  <div class="subtitle-options-step">
    <p class="step-intro">Como você quer aplicar a legenda?</p>
    <div class="mode-list">
      <button
        v-for="mode in MODES"
        :key="mode.id"
        class="mode-card"
        :class="{ selected: model.mode === mode.id }"
        @click="model.mode = mode.id"
      >
        <div class="mode-label">{{ mode.label }}</div>
        <div class="mode-description">{{ mode.description }}</div>
      </button>
    </div>
    <button class="btn btn-primary continue-btn" @click="emit('continue')">Avançar →</button>
  </div>
</template>

<style scoped>
.subtitle-options-step {
  max-width: 640px;
  margin: 0 auto;
}

.step-intro {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 16px;
  text-align: center;
}

.mode-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-card {
  text-align: left;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: 10px;
  padding: 12px 14px;
}

.mode-card:hover {
  border-color: var(--accent);
}

.mode-card.selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-elevated));
}

.mode-label {
  font-weight: 600;
  font-size: 13px;
}

.mode-description {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 2px;
}

.continue-btn {
  width: 100%;
  padding: 11px;
  font-size: 14px;
  margin-top: 16px;
}
</style>
