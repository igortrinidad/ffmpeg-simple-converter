<script setup lang="ts">
import type { ConversionOptionsInput } from '@shared/types'

const model = defineModel<ConversionOptionsInput>({ required: true })
</script>

<template>
  <div class="field-group">
    <h3>Configurações de conversão</h3>
    <label for="preset">Velocidade (mais rápido = qualidade um pouco menor)</label>
    <select id="preset" v-model="model.preset">
      <option value="ultrafast">Ultra rápido</option>
      <option value="superfast">Muito rápido</option>
      <option value="veryfast">Rápido</option>
      <option value="faster">Mais rápido que o padrão</option>
      <option value="fast">Rápido (equilibrado)</option>
      <option value="medium">Padrão (equilibrado)</option>
      <option value="slow">Lento (melhor qualidade)</option>
    </select>
    <label class="checkbox-label">
      <input v-model="model.hwaccel" type="checkbox" />
      Usar aceleração de hardware (GPU), se disponível
    </label>
  </div>
</template>

<style scoped>
.field-group > * + * {
  margin-top: 10px;
}

.field-group h3 {
  font-size: 13px;
  margin: 0 0 10px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.checkbox-label input {
  width: auto;
}
</style>
