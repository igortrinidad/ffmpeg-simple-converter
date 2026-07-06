<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getOperation } from '@shared/operations'
import type { ConversionOptionsInput, ExportOptionsInput, FileKind, JobRequest, OperationId } from '@shared/types'
import { useStepFlow } from '../../composables/useStepFlow'
import { useRetry } from '../../composables/useRetry'
import type { HighlightOptionsFormModel } from '../../shared/components/HighlightOptionsForm.vue'
import { CUSTOM_MODEL } from '../../shared/constants'
import SelectFilesStep from './steps/SelectFilesStep.vue'
import SelectFunctionStep from './steps/SelectFunctionStep.vue'
import OptionsStep from './steps/OptionsStep.vue'
import OutputSelectionStep from '../../shared/components/OutputSelectionStep.vue'
import ProcessingPanel from '../../shared/components/ProcessingPanel.vue'

const retry = useRetry()

const stepOrder = computed(() => ['files', 'function', 'options', 'output', 'processing'])
const flow = useStepFlow(stepOrder)

const filePaths = ref<string[]>([])
const fileKind = ref<FileKind>('video')
const operationId = ref<OperationId | null>(null)

const conversionForm = ref<ConversionOptionsInput>({ preset: 'medium', hwaccel: true })
const highlightForm = ref<HighlightOptionsFormModel>({
  provider: 'anthropic',
  modelChoice: '',
  customModel: '',
  prompt: '',
  marginSeconds: 2
})
const exportOptions = ref<ExportOptionsInput>({ formats: [], quality: 'standard', framing: 'crop' })

const operation = computed(() => (operationId.value ? getOperation(operationId.value) : null))
const needsOptionsStep = computed(
  () => !!operation.value && (operation.value.needsConversionOptions || operation.value.needsHighlightOptions)
)
// Only offer platform re-export when this operation actually produces a final video file.
const needsOutputStep = computed(
  () => operationId.value === 'video-full' || operationId.value === 'video-convert' || operationId.value === 'video-highlights'
)

onMounted(() => {
  const pending = retry.consumeRetry()
  if (!pending) return

  filePaths.value = [pending.filePath]
  operationId.value = pending.operation
  if (pending.conversionOptions) Object.assign(conversionForm.value, pending.conversionOptions)
  if (pending.highlightOptions) {
    highlightForm.value.provider = pending.highlightOptions.provider
    highlightForm.value.prompt = pending.highlightOptions.prompt
    highlightForm.value.marginSeconds = pending.highlightOptions.marginSeconds
    highlightForm.value.modelChoice = pending.highlightOptions.model
    highlightForm.value.customModel = pending.highlightOptions.model
  }
  if (pending.exportOptions) exportOptions.value = pending.exportOptions

  flow.goTo(needsOptionsStep.value ? 'options' : needsOutputStep.value ? 'output' : 'processing')
})

function onFilesSelected(paths: string[], kind: FileKind): void {
  filePaths.value = paths
  fileKind.value = kind
  flow.next()
}

function onFunctionSelected(id: OperationId): void {
  operationId.value = id
  flow.goTo(needsOptionsStep.value ? 'options' : needsOutputStep.value ? 'output' : 'processing')
}

const jobRequest = computed<JobRequest>(() => {
  const modelValue = highlightForm.value.modelChoice === CUSTOM_MODEL ? highlightForm.value.customModel : highlightForm.value.modelChoice
  return {
    operation: operationId.value!,
    filePaths: filePaths.value,
    conversionOptions: operation.value?.needsConversionOptions ? { ...conversionForm.value } : undefined,
    highlightOptions: operation.value?.needsHighlightOptions
      ? {
          provider: highlightForm.value.provider,
          model: modelValue.trim(),
          prompt: highlightForm.value.prompt.trim(),
          marginSeconds: highlightForm.value.marginSeconds
        }
      : undefined,
    exportOptions: needsOutputStep.value && exportOptions.value.formats.length ? { ...exportOptions.value } : undefined
  }
})

function resetFlow(): void {
  filePaths.value = []
  operationId.value = null
  exportOptions.value = { formats: [], quality: 'standard', framing: 'crop' }
  flow.reset()
}
</script>

<template>
  <div class="convert-flow">
    <SelectFilesStep v-if="flow.currentStep.value === 'files'" @continue="onFilesSelected" />
    <SelectFunctionStep
      v-else-if="flow.currentStep.value === 'function'"
      :file-kind="fileKind"
      :file-count="filePaths.length"
      @continue="onFunctionSelected"
    />
    <OptionsStep
      v-else-if="flow.currentStep.value === 'options' && operationId"
      :operation-id="operationId"
      v-model:conversion-form="conversionForm"
      v-model:highlight-form="highlightForm"
      @continue="flow.goTo(needsOutputStep ? 'output' : 'processing')"
    />
    <OutputSelectionStep
      v-else-if="flow.currentStep.value === 'output'"
      v-model="exportOptions"
      @continue="flow.next()"
    />
    <ProcessingPanel v-else-if="flow.currentStep.value === 'processing'" :request="jobRequest" />

    <button v-if="flow.currentStep.value === 'processing'" class="btn new-run-btn" @click="resetFlow">
      + Nova conversão
    </button>
  </div>
</template>

<style scoped>
.convert-flow {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.new-run-btn {
  align-self: center;
}
</style>
