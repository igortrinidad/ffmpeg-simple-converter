<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CompressResult } from '@shared/types'
import { useStepFlow } from '../../composables/useStepFlow'
import { useScreenRecorder, type StartRecordingOptions } from './composables/useScreenRecorder'
import ScreencastSetupStep from './steps/ScreencastSetupStep.vue'

const recorder = useScreenRecorder()

const stepOrder = computed(() => ['setup', 'recording', 'processing'])
const flow = useStepFlow(stepOrder)

const rawFilePath = ref<string | null>(null)
const stopError = ref('')

// The raw MediaRecorder .webm is large and inefficient, so we optimize it with
// the compress pipeline: re-encode to a size-capped H.264 mp4 downscaled to
// 1080p. Budget ~8 Mbps of video (screen content stays crisp at 1080p) plus a
// small audio allowance, spread over the recorded duration — the compressor's
// -crf still keeps quality from exceeding what's actually needed.
const TARGET_VIDEO_KBPS = 8000
const TARGET_AUDIO_KBPS = 128
const MAX_HEIGHT = 1080

const compressing = ref(false)
const compressError = ref('')
const compressResult = ref<CompressResult | null>(null)

async function onStart(options: StartRecordingOptions): Promise<void> {
  await recorder.startRecording(options)
  flow.goTo('recording')
}

// A stop can be triggered from the floating control window (which drives the
// recorder directly, bypassing this component) or from the in-app button.
// Either way the recorder lands in 'converting' with the saved raw path, so
// advance the flow off the shared state and kick off the optimization.
watch(
  () => recorder.state.phase,
  (phase) => {
    if (phase === 'converting' && recorder.state.rawFilePath && !rawFilePath.value) {
      rawFilePath.value = recorder.state.rawFilePath
      flow.goTo('processing')
      void optimize(recorder.state.rawFilePath, recorder.state.elapsedSeconds)
    }
  }
)

async function optimize(inputPath: string, durationSeconds: number): Promise<void> {
  compressing.value = true
  compressError.value = ''
  compressResult.value = null
  try {
    const targetSizeMB = Math.max(
      5,
      Math.ceil(((TARGET_VIDEO_KBPS + TARGET_AUDIO_KBPS) * Math.max(durationSeconds, 1)) / 8192)
    )
    compressResult.value = await window.api.compress.run({
      inputPath,
      targetSizeMB,
      preset: 'slow',
      maxHeight: MAX_HEIGHT
    })
  } catch (err: any) {
    compressError.value = err?.message || 'Não foi possível otimizar a gravação'
  } finally {
    compressing.value = false
  }
}

async function stopRecording(): Promise<void> {
  stopError.value = ''
  try {
    await recorder.stop()
  } catch (err: any) {
    stopError.value = err?.message || 'Não foi possível finalizar a gravação'
  }
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function openOutput(): Promise<void> {
  if (compressResult.value) await window.api.files.openFile(compressResult.value.outputPath)
}

function revealOutput(): void {
  if (compressResult.value) window.api.files.revealInFolder(compressResult.value.outputPath)
}

function resetFlow(): void {
  recorder.reset()
  rawFilePath.value = null
  stopError.value = ''
  compressError.value = ''
  compressResult.value = null
  flow.reset()
}
</script>

<template>
  <div class="screencast-flow">
    <ScreencastSetupStep v-if="flow.currentStep.value === 'setup'" @continue="onStart" />

    <div v-else-if="flow.currentStep.value === 'recording'" class="recording-notice">
      <p>🔴 Gravando… use o painel flutuante para pausar/parar.</p>
      <p class="hint">Se a janela principal reapareceu, você também pode parar por aqui.</p>
      <button class="btn btn-primary" type="button" @click="stopRecording">■ Parar gravação</button>
      <p v-if="stopError" class="error-text">{{ stopError }}</p>
    </div>

    <div v-else-if="flow.currentStep.value === 'processing'" class="processing">
      <template v-if="compressing">
        <h3>Otimizando gravação para 1080p…</h3>
        <p class="hint">Convertendo e comprimindo o vídeo — isso pode levar alguns instantes.</p>
      </template>

      <template v-else-if="compressError">
        <h3 class="title-danger">⚠️ Falha ao otimizar</h3>
        <p class="error-text">{{ compressError }}</p>
        <p v-if="rawFilePath" class="result-path">Arquivo bruto salvo em: {{ rawFilePath }}</p>
      </template>

      <template v-else-if="compressResult">
        <h3 class="title-success">✅ Gravação pronta</h3>
        <p>Vídeo otimizado (1080p): <strong>{{ formatMB(compressResult.sizeBytes) }}</strong></p>
        <p class="result-path" :title="compressResult.outputPath">{{ compressResult.outputPath }}</p>
        <div class="result-actions">
          <button class="btn btn-ghost" @click="openOutput">Abrir</button>
          <button class="btn btn-ghost" @click="revealOutput">Mostrar na pasta</button>
        </div>
      </template>

      <button v-if="!compressing" class="btn new-run-btn" @click="resetFlow">+ Nova gravação</button>
    </div>
  </div>
</template>

<style scoped>
.screencast-flow {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.recording-notice,
.processing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.hint {
  color: var(--text-muted);
  font-size: 12px;
}

.error-text {
  color: var(--danger);
  font-size: 12px;
}

.title-success {
  color: var(--success);
  margin: 0;
}

.title-danger {
  color: var(--warning);
  margin: 0;
}

.result-path {
  color: var(--text-muted);
  font-size: 11px;
  word-break: break-all;
}

.result-actions {
  display: flex;
  gap: 8px;
}

.new-run-btn {
  align-self: center;
  margin-top: 8px;
}
</style>
