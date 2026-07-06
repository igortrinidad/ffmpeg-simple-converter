<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useStepFlow } from '../../composables/useStepFlow'
import { useNavigation } from '../../composables/useNavigation'
import SelectFilesStep from './steps/SelectFilesStep.vue'
import SelectAgentStep from './steps/SelectAgentStep.vue'
import TranscribeStep from './steps/TranscribeStep.vue'
import ConversationStep from './steps/ConversationStep.vue'
import OutputSelectionStep from '../../shared/components/OutputSelectionStep.vue'
import CutProcessingStep from './steps/CutProcessingStep.vue'
import type { AIProviderName, ExportOptionsInput } from '@shared/types'

const nav = useNavigation()

const stepOrder = computed(() => ['files', 'agent', 'transcribe', 'conversation', 'output', 'processing'])
const flow = useStepFlow(stepOrder)

const filePath = ref<string | null>(null)
const agentId = ref<string | undefined>(undefined)
const objective = ref<string | undefined>(undefined)
const provider = ref<AIProviderName>('anthropic')
const model = ref('')
const jobId = ref<string | null>(null)
const sessionId = ref<string | null>(null)
const marginSeconds = ref(2)
const exportOptions = ref<ExportOptionsInput>({ formats: [], quality: 'standard', framing: 'crop' })
const conversationMode = ref<'start' | 'resume'>('start')
const resumeSessionId = ref<string | null>(null)

// Skip the output-selection step entirely when the chosen agent already fully
// defines which formats/quality/framing to export to.
const agentDefinesOutput = computed(() => !!agentId.value && exportOptions.value.formats.length > 0)

onMounted(() => {
  const pendingResumeId = nav.consumeChatResume()
  if (pendingResumeId) {
    resumeSessionId.value = pendingResumeId
    conversationMode.value = 'resume'
    flow.goTo('conversation')
  }
})

function resetFlow(): void {
  filePath.value = null
  agentId.value = undefined
  objective.value = undefined
  jobId.value = null
  sessionId.value = null
  exportOptions.value = { formats: [], quality: 'standard', framing: 'crop' }
  conversationMode.value = 'start'
  resumeSessionId.value = null
  flow.reset()
}

function onFilesSelected(path: string): void {
  filePath.value = path
  flow.next()
}

function onAgentSelected(payload: {
  agentId?: string
  objective?: string
  exportOptions?: ExportOptionsInput
  provider: string
  model: string
}): void {
  agentId.value = payload.agentId
  objective.value = payload.objective
  provider.value = payload.provider as AIProviderName
  model.value = payload.model
  if (payload.exportOptions) exportOptions.value = payload.exportOptions
  flow.next()
}

function onTranscribeReady(id: string): void {
  jobId.value = id
  flow.next()
}

function onConversationContinue(id: string, margin: number): void {
  sessionId.value = id
  marginSeconds.value = margin
  flow.goTo(agentDefinesOutput.value ? 'processing' : 'output')
}

function onResumed(info: { agentId?: string; exportOptions?: ExportOptionsInput }): void {
  agentId.value = info.agentId
  if (info.exportOptions) exportOptions.value = info.exportOptions
}

const startParams = computed(() =>
  jobId.value
    ? { jobId: jobId.value, provider: provider.value, model: model.value, agentId: agentId.value, objective: objective.value }
    : undefined
)
</script>

<template>
  <div class="chat-flow">
    <SelectFilesStep v-if="flow.currentStep.value === 'files'" @continue="onFilesSelected" />
    <SelectAgentStep v-else-if="flow.currentStep.value === 'agent'" @continue="onAgentSelected" />
    <TranscribeStep v-else-if="flow.currentStep.value === 'transcribe' && filePath" :file-path="filePath" @ready="onTranscribeReady" />
    <ConversationStep
      v-else-if="flow.currentStep.value === 'conversation'"
      :mode="conversationMode"
      :start-params="startParams"
      :resume-session-id="resumeSessionId ?? undefined"
      @continue="onConversationContinue"
      @resumed="onResumed"
    />
    <OutputSelectionStep
      v-else-if="flow.currentStep.value === 'output'"
      v-model="exportOptions"
      @continue="flow.next()"
    />
    <CutProcessingStep
      v-else-if="flow.currentStep.value === 'processing' && sessionId"
      :session-id="sessionId"
      :margin-seconds="marginSeconds"
      :export-options="exportOptions"
    />

    <button
      v-if="flow.currentStep.value === 'processing'"
      class="btn new-chat-btn"
      @click="resetFlow"
    >
      + Nova conversa
    </button>
  </div>
</template>

<style scoped>
.chat-flow {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.new-chat-btn {
  align-self: center;
}
</style>
