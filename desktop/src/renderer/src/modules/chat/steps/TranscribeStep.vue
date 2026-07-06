<script setup lang="ts">
import { computed, ref } from 'vue'
import ProcessingPanel from '../../../shared/components/ProcessingPanel.vue'
import type { JobRequest } from '@shared/types'

const props = defineProps<{
  filePath: string
}>()

const emit = defineEmits<{
  ready: [jobId: string]
}>()

const jobId = ref<string | null>(null)

const request = computed<JobRequest>(() => ({
  operation: 'video-highlights-chat',
  filePaths: [props.filePath]
}))

function onJobId(id: string): void {
  jobId.value = id
}

function onFinished(_outputFiles: string[], success: boolean): void {
  if (success && jobId.value) emit('ready', jobId.value)
}
</script>

<template>
  <div class="transcribe-step">
    <ProcessingPanel :request="request" @job-id="onJobId" @finished="onFinished" />
  </div>
</template>
