<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CompressRequest, CompressResult } from '@shared/types'
import FileDropzone from '../../shared/components/FileDropzone.vue'

type Preset = CompressRequest['preset']

const filePath = ref<string | null>(null)
const targetSizeMB = ref(15)
const preset = ref<Preset>('slow')
const maxHeight = ref<number | null>(720)
const monoAudio = ref(false)

const isRunning = ref(false)
const error = ref<string | null>(null)
const result = ref<CompressResult | null>(null)

const canRun = computed(() => !!filePath.value && targetSizeMB.value > 0 && !isRunning.value)

function onFileSelected(paths: string[]): void {
  filePath.value = paths[0] ?? null
  result.value = null
  error.value = null
}

function reset(): void {
  filePath.value = null
  result.value = null
  error.value = null
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function run(): Promise<void> {
  if (!filePath.value) return
  isRunning.value = true
  error.value = null
  result.value = null

  try {
    result.value = await window.api.compress.run({
      inputPath: filePath.value,
      targetSizeMB: targetSizeMB.value,
      preset: preset.value,
      maxHeight: maxHeight.value ?? undefined,
      monoAudio: monoAudio.value
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isRunning.value = false
  }
}

function revealOutput(): void {
  if (result.value) window.api.files.revealInFolder(result.value.outputPath)
}
</script>

<template>
  <div class="compress-flow">
    <h2>Comprimir vídeo</h2>
    <p class="hint">Escolha um vídeo e um tamanho máximo de saída — o bitrate é calculado a partir da duração do vídeo.</p>

    <FileDropzone v-if="!filePath" :max-files="1" only-kind="video" @continue="onFileSelected" />

    <section v-else class="card options">
      <div class="selected-file">
        <span class="file-icon">🎬</span>
        <span class="file-name" :title="filePath">{{ filePath.split(/[/\\]/).pop() }}</span>
        <button class="btn btn-ghost" :disabled="isRunning" @click="reset">Trocar arquivo</button>
      </div>

      <div class="field-group">
        <label>Tamanho máximo de saída (MB)</label>
        <input v-model.number="targetSizeMB" type="number" min="1" step="1" :disabled="isRunning" />
      </div>

      <div class="field-group">
        <label>Qualidade (preset)</label>
        <select v-model="preset" :disabled="isRunning">
          <option value="veryfast">Rascunho (rápido)</option>
          <option value="medium">Padrão</option>
          <option value="slow">Alta (recomendado)</option>
          <option value="veryslow">Máxima (mais lento)</option>
        </select>
      </div>

      <div class="field-group">
        <label>Altura máxima (opcional, mantém proporção)</label>
        <select v-model.number="maxHeight" :disabled="isRunning">
          <option :value="null">Sem redimensionar</option>
          <option :value="480">480p</option>
          <option :value="720">720p</option>
          <option :value="1080">1080p</option>
        </select>
      </div>

      <label class="checkbox-field">
        <input v-model="monoAudio" type="checkbox" :disabled="isRunning" />
        Áudio em mono (economiza espaço extra)
      </label>

      <button class="btn btn-primary run-btn" :disabled="!canRun" @click="run">
        {{ isRunning ? 'Comprimindo…' : 'Comprimir vídeo' }}
      </button>

      <p v-if="error" class="hint hint-warning">{{ error }}</p>

      <div v-if="result" class="result">
        <p>✓ Vídeo comprimido: <strong>{{ formatMB(result.sizeBytes) }}</strong></p>
        <p class="result-path" :title="result.outputPath">{{ result.outputPath }}</p>
        <button class="btn btn-ghost" @click="revealOutput">Mostrar na pasta</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.compress-flow {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.compress-flow h2 {
  margin: 0;
  font-size: 20px;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.hint-warning {
  color: var(--warning);
}

.options {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-group label {
  font-size: 13px;
  font-weight: 600;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.checkbox-field input {
  width: auto;
}

.run-btn {
  padding: 11px;
  font-size: 14px;
}

.result {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.result-path {
  color: var(--text-muted);
  font-size: 11px;
  word-break: break-all;
}
</style>
