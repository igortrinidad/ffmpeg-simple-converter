<script setup lang="ts">
import { EXPORT_FORMATS, QUALITY_PRESETS } from '@shared/exportFormats'
import type { ExportOptionsInput, ExportFormatId, QualityPresetId, FramingMode } from '@shared/types'

const model = defineModel<ExportOptionsInput>({ required: true })

function toggleFormat(id: ExportFormatId): void {
  const formats = model.value.formats.includes(id)
    ? model.value.formats.filter((f) => f !== id)
    : [...model.value.formats, id]
  model.value = { ...model.value, formats }
}
</script>

<template>
  <div class="output-format-picker">
    <div class="field-group">
      <h3>Formatos de export</h3>
      <p class="hint">Escolha para quais plataformas/proporções exportar (pode marcar mais de uma).</p>
      <div class="format-grid">
        <label
          v-for="format in EXPORT_FORMATS"
          :key="format.id"
          class="format-option"
          :class="{ active: model.formats.includes(format.id) }"
        >
          <input
            type="checkbox"
            :checked="model.formats.includes(format.id)"
            @change="toggleFormat(format.id)"
          />
          {{ format.label }}
        </label>
      </div>
    </div>

    <div class="field-group">
      <h3>Qualidade</h3>
      <select
        :value="model.quality"
        @change="model = { ...model, quality: ($event.target as HTMLSelectElement).value as QualityPresetId }"
      >
        <option v-for="q in QUALITY_PRESETS" :key="q.id" :value="q.id">{{ q.label }}</option>
      </select>
    </div>

    <div v-if="model.formats.length" class="field-group">
      <h3>Enquadramento</h3>
      <p class="hint">
        Usado quando o vídeo original não tem a mesma proporção do formato escolhido.
      </p>
      <select
        :value="model.framing"
        @change="model = { ...model, framing: ($event.target as HTMLSelectElement).value as FramingMode }"
      >
        <option value="crop">Crop central (preenche, corta bordas)</option>
        <option value="blur-pad">Fit com blur nas bordas (mantém o frame inteiro)</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.output-format-picker {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field-group h3 {
  font-size: 13px;
  margin: 0 0 8px;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0 0 10px;
}

.format-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.format-option {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.format-option input {
  width: auto;
}

.format-option.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg));
}
</style>
