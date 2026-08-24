<script setup lang="ts">
import { computed, ref } from 'vue'
import type { JobRequest } from '@shared/types'
import { useStepFlow } from '../../composables/useStepFlow'
import { useScreenRecorder, type StartRecordingOptions } from './composables/useScreenRecorder'
import ScreencastSetupStep from './steps/ScreencastSetupStep.vue'
import ProcessingPanel from '../../shared/components/ProcessingPanel.vue'

const recorder = useScreenRecorder()

const stepOrder = computed(() => ['setup', 'recording', 'processing'])
const flow = useStepFlow(stepOrder)

const rawFilePath = ref<string | null>(null)
const stopError = ref('')

const jobRequest = computed<JobRequest | null>(() =>
  rawFilePath.value
    ? {
        operation: 'video-convert',
        filePaths: [rawFilePath.value],
        conversionOptions: { preset: 'slow', hwaccel: true }
      }
    : null
)

async function onStart(options: StartRecordingOptions): Promise<void> {
  await recorder.startRecording(options)
  flow.goTo('recording')
}

async function stopRecording(): Promise<void> {
  stopError.value = ''
  try {
    rawFilePath.value = await recorder.stop()
    flow.goTo('processing')
  } catch (err: any) {
    stopError.value = err?.message || 'Não foi possível finalizar a gravação'
  }
}

function resetFlow(): void {
  recorder.reset()
  rawFilePath.value = null
  stopError.value = ''
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

    <ProcessingPanel v-else-if="flow.currentStep.value === 'processing' && jobRequest" :request="jobRequest" />

    <button v-if="flow.currentStep.value === 'processing'" class="btn new-run-btn" @click="resetFlow">
      + Nova gravação
    </button>
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

.recording-notice {
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

.new-run-btn {
  align-self: center;
}
</style>
