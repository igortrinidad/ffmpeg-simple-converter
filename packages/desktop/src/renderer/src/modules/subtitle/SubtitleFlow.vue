<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { JobRequest, SubtitleOptionsInput } from '@shared/types'
import { useStepFlow } from '../../composables/useStepFlow'
import { useRetry } from '../../composables/useRetry'
import FileDropzone from '../../shared/components/FileDropzone.vue'
import SubtitleOptionsStep from './steps/SubtitleOptionsStep.vue'
import ProcessingPanel from '../../shared/components/ProcessingPanel.vue'

const OPERATION_ID = 'video-apply-subtitles' as const

const retry = useRetry()

const stepOrder = computed(() => ['files', 'options', 'processing'])
const flow = useStepFlow(stepOrder)

const filePaths = ref<string[]>([])
const subtitleOptions = ref<SubtitleOptionsInput>({ mode: 'hardsub' })

onMounted(() => {
  const pending = retry.consumeRetry()
  if (!pending || pending.operation !== OPERATION_ID) return

  filePaths.value = [pending.filePath]
  if (pending.subtitleOptions) subtitleOptions.value = { ...pending.subtitleOptions }
  flow.goTo('options')
})

function onFilesSelected(paths: string[]): void {
  filePaths.value = paths
  flow.next()
}

const jobRequest = computed<JobRequest>(() => ({
  operation: OPERATION_ID,
  filePaths: filePaths.value,
  subtitleOptions: { ...subtitleOptions.value }
}))

function resetFlow(): void {
  filePaths.value = []
  subtitleOptions.value = { mode: 'hardsub' }
  flow.reset()
}
</script>

<template>
  <div class="subtitle-flow">
    <template v-if="flow.currentStep.value === 'files'">
      <p class="step-intro">Selecione 1 vídeo para gerar e aplicar a legenda.</p>
      <FileDropzone :max-files="1" only-kind="video" @continue="onFilesSelected" />
    </template>
    <SubtitleOptionsStep
      v-else-if="flow.currentStep.value === 'options'"
      v-model="subtitleOptions"
      @continue="flow.next()"
    />
    <ProcessingPanel v-else-if="flow.currentStep.value === 'processing'" :request="jobRequest" />

    <button v-if="flow.currentStep.value === 'processing'" class="btn new-run-btn" @click="resetFlow">
      + Nova legenda
    </button>
  </div>
</template>

<style scoped>
.subtitle-flow {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.step-intro {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 16px;
  text-align: center;
}

.new-run-btn {
  align-self: center;
}
</style>
