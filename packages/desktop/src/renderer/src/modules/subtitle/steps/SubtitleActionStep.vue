<script setup lang="ts">
import type { SubtitleAction } from '../actions'

const emit = defineEmits<{
  continue: [action: SubtitleAction]
}>()

const ACTIONS: { id: SubtitleAction; label: string; description: string }[] = [
  {
    id: 'apply',
    label: 'Aplicar legenda ao vídeo',
    description: 'Transcreve o vídeo e grava a legenda nele — embutida nos quadros (hardsub) ou como faixa que pode ser ligada/desligada (softsub).'
  },
  {
    id: 'srt',
    label: 'Extrair legenda (.srt) com timeline',
    description: 'Gera um arquivo .srt com a linha do tempo completa, pronto para editar ou subir junto com o vídeo.'
  },
  {
    id: 'text',
    label: 'Extrair legenda apenas em texto',
    description: 'Gera um .txt só com o que é falado, sem os tempos — para copiar, revisar ou reaproveitar o conteúdo.'
  }
]
</script>

<template>
  <div class="subtitle-action-step">
    <p class="step-intro">O que você quer fazer com a legenda?</p>
    <div class="action-list">
      <button
        v-for="action in ACTIONS"
        :key="action.id"
        class="action-card"
        @click="emit('continue', action.id)"
      >
        <div class="action-label">{{ action.label }}</div>
        <div class="action-description">{{ action.description }}</div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.subtitle-action-step {
  max-width: 640px;
  margin: 0 auto;
}

.step-intro {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 16px;
  text-align: center;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-card {
  text-align: left;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: 10px;
  padding: 12px 14px;
}

.action-card:hover {
  border-color: var(--accent);
}

.action-label {
  font-weight: 600;
  font-size: 13px;
}

.action-description {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 2px;
}
</style>
