<script setup lang="ts">
import FileDropzone from '../../../shared/components/FileDropzone.vue'

const emit = defineEmits<{
  continue: [filePath: string]
}>()

function onContinue(paths: string[]): void {
  emit('continue', paths[0])
}
</script>

<template>
  <div class="select-files-step">
    <p class="step-intro">Selecione 1 vídeo para conversar com a IA e escolher os melhores trechos.</p>
    <FileDropzone :max-files="1" only-kind="video" @continue="onContinue" />
  </div>
</template>

<style scoped>
.step-intro {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 16px;
  text-align: center;
}
</style>
