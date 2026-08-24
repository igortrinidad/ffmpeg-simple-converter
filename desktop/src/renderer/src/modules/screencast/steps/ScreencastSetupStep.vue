<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ScreenSource } from '@shared/types'
import { useScreenRecorder, type RecordingDeviceOption, type StartRecordingOptions } from '../composables/useScreenRecorder'

const emit = defineEmits<{
  continue: [options: StartRecordingOptions]
}>()

const recorder = useScreenRecorder()

const sources = ref<ScreenSource[]>([])
const selectedSourceId = ref<string | null>(null)
const cameras = ref<RecordingDeviceOption[]>([])
const mics = ref<RecordingDeviceOption[]>([])
const cameraEnabled = ref(false)
const micEnabled = ref(false)
const selectedCameraId = ref('')
const selectedMicId = ref('')
const loading = ref(true)
const starting = ref(false)
const error = ref('')

async function loadSources(): Promise<void> {
  sources.value = await recorder.listScreenSources()
  if (!selectedSourceId.value && sources.value.length) {
    selectedSourceId.value = sources.value[0].id
  }
}

onMounted(async () => {
  try {
    await loadSources()
    const devices = await recorder.listMediaDevices()
    cameras.value = devices.cameras
    mics.value = devices.mics
    selectedCameraId.value = devices.cameras[0]?.deviceId ?? ''
    selectedMicId.value = devices.mics[0]?.deviceId ?? ''
  } catch (err: any) {
    error.value = err?.message || 'Não foi possível listar telas/dispositivos'
  } finally {
    loading.value = false
  }
})

async function start(): Promise<void> {
  if (!selectedSourceId.value) return
  starting.value = true
  error.value = ''
  try {
    emit('continue', {
      sourceId: selectedSourceId.value,
      cameraDeviceId: cameraEnabled.value ? selectedCameraId.value || undefined : undefined,
      micDeviceId: micEnabled.value ? selectedMicId.value || undefined : undefined
    })
  } catch (err: any) {
    error.value = err?.message || 'Não foi possível iniciar a gravação'
    starting.value = false
  }
}
</script>

<template>
  <div class="screencast-setup">
    <p class="step-intro">Grave a tela ou uma janela, com câmera e microfone opcionais.</p>

    <div v-if="loading" class="hint">Carregando telas e dispositivos…</div>

    <template v-else>
      <div class="section">
        <div class="section-header">
          <span class="section-title">Tela ou janela</span>
          <button class="btn btn-ghost btn-refresh" type="button" @click="loadSources">↻ Atualizar</button>
        </div>
        <div class="source-grid">
          <button
            v-for="source in sources"
            :key="source.id"
            type="button"
            class="source-card"
            :class="{ active: selectedSourceId === source.id }"
            @click="selectedSourceId = source.id"
          >
            <img :src="source.thumbnailDataUrl" :alt="source.name" class="source-thumb" />
            <span class="source-name" :title="source.name">{{ source.name }}</span>
          </button>
        </div>
      </div>

      <div class="section toggle-row">
        <label class="toggle-label">
          <input v-model="cameraEnabled" type="checkbox" />
          Gravar câmera
        </label>
        <select v-if="cameraEnabled" v-model="selectedCameraId" class="device-select">
          <option v-for="cam in cameras" :key="cam.deviceId" :value="cam.deviceId">{{ cam.label }}</option>
        </select>
      </div>

      <div class="section toggle-row">
        <label class="toggle-label">
          <input v-model="micEnabled" type="checkbox" />
          Gravar microfone
        </label>
        <select v-if="micEnabled" v-model="selectedMicId" class="device-select">
          <option v-for="mic in mics" :key="mic.deviceId" :value="mic.deviceId">{{ mic.label }}</option>
        </select>
      </div>

      <p v-if="error" class="error-text">{{ error }}</p>

      <button class="btn btn-primary start-btn" type="button" :disabled="!selectedSourceId || starting" @click="start">
        {{ starting ? 'Iniciando…' : '● Iniciar gravação' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.screencast-setup {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-intro {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0;
  text-align: center;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-weight: 600;
  font-size: 13px;
}

.btn-refresh {
  font-size: 11px;
  padding: 4px 8px;
}

.source-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}

.source-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  border-radius: 10px;
  padding: 6px;
  text-align: left;
}

.source-card.active {
  border-color: var(--accent);
}

.source-thumb {
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  border-radius: 6px;
  background: var(--bg);
}

.source-name {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toggle-row {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.device-select {
  flex: 1;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
}

.error-text {
  color: var(--danger);
  font-size: 12px;
  margin: 0;
}

.start-btn {
  align-self: center;
}
</style>
