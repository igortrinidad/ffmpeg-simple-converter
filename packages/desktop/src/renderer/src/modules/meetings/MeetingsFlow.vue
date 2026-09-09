<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { MeetingCreateRequest, MeetingDetail } from '@shared/types'
import { useMeetingRecorder } from './composables/useMeetingRecorder'
import { useMeetings } from './composables/useMeetings'
import MeetingsListView from './MeetingsListView.vue'
import MeetingSetupStep from './steps/MeetingSetupStep.vue'
import MeetingProcessingStep from './steps/MeetingProcessingStep.vue'
import MeetingDetailView from './steps/MeetingDetailView.vue'

type View = 'list' | 'setup' | 'recording' | 'processing' | 'detail'

const recorder = useMeetingRecorder()
const { state: meetingsState, load: loadMeetings, remove: removeMeeting } = useMeetings()

const view = ref<View>('list')
const startingRecording = ref(false)
const processingId = ref<string | null>(null)
const detail = ref<MeetingDetail | null>(null)
const error = ref('')
const confirmingCancel = ref(false)

const formattedElapsed = computed(() => {
  const total = recorder.state.elapsedSeconds
  const pad = (value: number): string => value.toString().padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
})

onMounted(loadMeetings)

// Stop can also come from the floating control window, which drives the
// recorder directly and never passes through `stopRecording` below — so the
// handoff to processing keys off the recorder's own state instead.
watch(
  () => recorder.state.finishedMeetingId,
  (meetingId) => {
    if (!meetingId) return
    processingId.value = meetingId
    view.value = 'processing'
    recorder.reset()
  }
)

// Discarding can also be triggered from the floating control window, which
// drives the recorder directly — the flow only learns about it through the
// phase going back to idle without a finished meeting to process.
watch(
  () => recorder.state.phase,
  (phase) => {
    if (phase === 'idle' && view.value === 'recording' && !recorder.state.finishedMeetingId) {
      view.value = 'list'
      confirmingCancel.value = false
      void loadMeetings()
    }
  }
)

async function startRecording(request: MeetingCreateRequest): Promise<void> {
  error.value = ''
  startingRecording.value = true
  try {
    await recorder.startRecording(request)
    view.value = 'recording'
  } catch (err: any) {
    error.value = err?.message || 'Não foi possível iniciar a gravação'
    view.value = 'setup'
  } finally {
    startingRecording.value = false
  }
}

async function stopRecording(): Promise<void> {
  error.value = ''
  try {
    await recorder.stop()
  } catch (err: any) {
    error.value = err?.message || 'Não foi possível finalizar a gravação'
  }
}

async function cancelRecording(): Promise<void> {
  confirmingCancel.value = false
  await recorder.cancel()
  view.value = 'list'
  await loadMeetings()
}

async function onProcessed(result: MeetingDetail): Promise<void> {
  detail.value = result
  processingId.value = null
  view.value = 'detail'
  await loadMeetings()
}

async function openMeeting(id: string): Promise<void> {
  error.value = ''
  try {
    const loaded = await window.api.meetings.get(id)
    // A meeting that was never processed (app closed mid-run, transcription
    // failed) has no minutes to show — send it back through processing instead
    // of opening an empty detail view.
    if (loaded.status === 'ready' || loaded.segments.length) {
      detail.value = loaded
      view.value = 'detail'
    } else {
      processingId.value = id
      view.value = 'processing'
    }
  } catch (err: any) {
    error.value = err?.message || 'Não foi possível abrir a reunião'
  }
}

async function deleteMeeting(id: string): Promise<void> {
  await removeMeeting(id, true)
}

async function backToList(): Promise<void> {
  detail.value = null
  view.value = 'list'
  await loadMeetings()
}
</script>

<template>
  <div class="meetings-flow">
    <p v-if="error" class="error-text">{{ error }}</p>

    <MeetingsListView
      v-if="view === 'list'"
      :meetings="meetingsState.meetings"
      :loaded="meetingsState.loaded"
      @new="view = 'setup'"
      @select="openMeeting"
      @remove="deleteMeeting"
    />

    <template v-else-if="view === 'setup'">
      <button class="btn btn-ghost back-btn" type="button" @click="backToList">← Reuniões</button>
      <MeetingSetupStep :busy="startingRecording" @start="startRecording" />
    </template>

    <div v-else-if="view === 'recording'" class="recording">
      <p class="rec-line"><span class="rec-dot" :class="{ paused: recorder.state.phase === 'paused' }" /> {{ formattedElapsed }}</p>
      <p class="hint">
        Gravando {{ recorder.state.micActive ? 'microfone' : '' }}
        {{ recorder.state.micActive && recorder.state.systemActive ? '+' : '' }}
        {{ recorder.state.systemActive ? 'som do sistema' : '' }}. Use o painel flutuante para pausar ou parar.
      </p>
      <p class="hint">O áudio é salvo em disco a cada 5 segundos — se algo travar, o que já foi gravado não se perde.</p>

      <template v-if="!confirmingCancel">
        <div class="actions">
          <button
            v-if="recorder.state.phase === 'recording'"
            class="btn"
            type="button"
            @click="recorder.pause()"
          >
            ⏸ Pausar
          </button>
          <button v-else-if="recorder.state.phase === 'paused'" class="btn" type="button" @click="recorder.resume()">
            ▶ Retomar
          </button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="recorder.state.phase === 'stopping'"
            @click="stopRecording"
          >
            {{ recorder.state.phase === 'stopping' ? 'Finalizando…' : '■ Encerrar e gerar ata' }}
          </button>
          <button class="btn btn-ghost cancel-btn" type="button" @click="confirmingCancel = true">✕ Descartar</button>
        </div>
      </template>
      <template v-else>
        <p class="confirm-text">Descartar esta gravação? O áudio será apagado e não dá para desfazer.</p>
        <div class="actions">
          <button class="btn btn-danger" type="button" @click="cancelRecording">Sim, descartar</button>
          <button class="btn btn-ghost" type="button" @click="confirmingCancel = false">Voltar</button>
        </div>
      </template>
    </div>

    <MeetingProcessingStep
      v-else-if="view === 'processing' && processingId"
      :key="processingId"
      :meeting-id="processingId"
      @ready="onProcessed"
    />

    <MeetingDetailView
      v-else-if="view === 'detail' && detail"
      :detail="detail"
      @updated="detail = $event"
      @back="backToList"
    />
  </div>
</template>

<style scoped>
.meetings-flow {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.back-btn {
  align-self: flex-start;
  font-size: 12px;
  padding: 5px 9px;
}

.recording {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.rec-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin: 0;
}

.rec-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--danger);
  animation: pulse 1.4s ease-in-out infinite;
}

.rec-dot.paused {
  animation: none;
  opacity: 0.4;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.hint {
  color: var(--text-muted);
  font-size: 12px;
  margin: 0;
  max-width: 460px;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.cancel-btn {
  color: var(--danger);
}

.confirm-text {
  color: var(--danger);
  font-size: 13px;
  max-width: 380px;
}

.btn-danger {
  border: 1px solid var(--danger);
  background: var(--danger);
  color: white;
}

.error-text {
  color: var(--danger);
  font-size: 12px;
  text-align: center;
  margin: 0;
}
</style>
