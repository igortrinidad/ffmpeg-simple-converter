<script setup lang="ts">
import OutputFormatPicker from './OutputFormatPicker.vue'
import type { ExportOptionsInput } from '@shared/types'

const model = defineModel<ExportOptionsInput>({ required: true })

const emit = defineEmits<{
  continue: []
}>()
</script>

<template>
  <div class="output-selection-step">
    <p class="step-intro">Escolha para quais formatos exportar os cortes.</p>
    <OutputFormatPicker v-model="model" />
    <button class="btn btn-primary continue-btn" @click="emit('continue')">Processar →</button>
  </div>
</template>

<style scoped>
.output-selection-step {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 480px;
  margin: 0 auto;
}

.step-intro {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0;
  text-align: center;
}

.continue-btn {
  padding: 11px;
  font-size: 14px;
}
</style>
