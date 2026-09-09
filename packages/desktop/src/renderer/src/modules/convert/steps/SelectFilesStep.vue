<script setup lang="ts">
import FileDropzone from '../../../shared/components/FileDropzone.vue'
import type { FileKind } from '@shared/types'

const emit = defineEmits<{
  continue: [filePaths: string[], kind: FileKind]
}>()
</script>

<template>
  <div class="select-files-step">
    <p class="step-intro">Selecione os arquivos que você quer converter/processar.</p>
    <FileDropzone @continue="(paths, kind) => emit('continue', paths, kind)" />
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
