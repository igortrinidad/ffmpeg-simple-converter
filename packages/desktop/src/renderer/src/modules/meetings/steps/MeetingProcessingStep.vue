<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { MeetingDetail, MeetingLogLine, MeetingProgressEvent } from '@shared/types'

const props = defineProps<{
  meetingId: string
}>()

const emit = defineEmits<{
  ready: [detail: MeetingDetail]
}>()

interface StepState {
  name: string
  status: MeetingProgressEvent['status']
}

const steps = ref<StepState[]>([])
const logs = ref<MeetingLogLine[]>([])
const error = ref('')
const running = ref(false)

let unsubscribeProgress: (() => void) | null = null
let unsubscribeLog: (() => void) | null = null

function trackProgress(event: MeetingProgressEvent): void {
  if (event.meetingId !== props.meetingId) return

  const existing = steps.value.find((step) => step.name === event.step)
  if (existing) existing.status = event.status
  else steps.value.push({ name: event.step, status: event.status })
}

async function run(): Promise<void> {
  running.value = true
  error.value = ''
  try {
    emit('ready', await window.api.meetings.process(props.meetingId))
  } catch (err: any) {
    error.value = err?.message || 'Falha ao processar a reunião'
  } finally {
    running.value = false
  }
}

onMounted(() => {
  unsubscribeProgress = window.api.meetings.onProgress(trackProgress)
  unsubscribeLog = window.api.meetings.onLog((line) => {
    if (line.meetingId !== props.meetingId) return
    logs.value.push(line)
    // The transcription pipeline is chatty (ffmpeg progress, chunk-by-chunk
    // uploads) — only the tail is useful, and keeping it bounded stops a long
    // meeting from growing this array without limit.
    if (logs.value.length > 200) logs.value.splice(0, logs.value.length - 200)
  })
  void run()
})

onBeforeUnmount(() => {
  unsubscribeProgress?.()
  unsubscribeLog?.()
})

function statusIcon(status: MeetingProgressEvent['status']): string {
  if (status === 'completed') return '✅'
  if (status === 'failed') return '❌'
  return '⏳'
}
</script>

<template>
  <div class="meeting-processing">
    <h3 v-if="running">Processando a reunião…</h3>
    <h3 v-else-if="error" class="title-danger">⚠️ Falha ao processar</h3>

    <p v-if="running" class="hint">
      Convertendo o áudio, transcrevendo cada faixa e escrevendo a ata. Uma reunião de 1 hora costuma levar poucos
      minutos.
    </p>

    <ul v-if="steps.length" class="step-list">
      <li v-for="step in steps" :key="step.name" :class="step.status">
        <span class="step-icon">{{ statusIcon(step.status) }}</span>
        {{ step.name }}
      </li>
    </ul>

    <p v-if="error" class="error-text">{{ error }}</p>

    <div v-if="logs.length" class="log-box">
      <div v-for="(line, index) in logs" :key="index" class="log-line" :class="line.level">{{ line.text }}</div>
    </div>

    <button v-if="error" class="btn btn-primary" type="button" @click="run">Tentar novamente</button>
  </div>
</template>

<style scoped>
.meeting-processing {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

h3 {
  margin: 0;
}

.title-danger {
  color: var(--warning);
}

.hint {
  color: var(--text-muted);
  font-size: 12px;
  margin: 0;
}

.step-list {
  list-style: none;
  padding: 0;
  margin: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  font-size: 13px;
}

.step-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 8px 10px;
}

.step-list li.failed {
  border-color: var(--danger);
}

.step-icon {
  flex-shrink: 0;
}

.error-text {
  color: var(--danger);
  font-size: 12px;
  margin: 0;
}

.log-box {
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 8px 10px;
  text-align: left;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--text-muted);
}

.log-line.warn {
  color: var(--warning);
}

.log-line.error {
  color: var(--danger);
}
</style>
