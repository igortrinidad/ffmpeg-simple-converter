<script setup lang="ts">
import { computed } from 'vue'
import { operationsForType } from '@shared/operations'
import type { FileKind, OperationId } from '@shared/types'

const props = defineProps<{
  fileKind: FileKind
  fileCount: number
}>()

const emit = defineEmits<{
  continue: [operationId: OperationId]
}>()

// Convert only covers the non-conversational operations — the Chat module owns
// the ones that hand off into the highlight conversation, and the Legendas
// module owns every subtitle one (applying a legenda to the video, and
// extracting it as .srt or as plain text).
const availableOperations = computed(() =>
  operationsForType(props.fileKind).filter((op) => !op.startsHighlightChat && !op.belongsToSubtitleModule)
)
</script>

<template>
  <div class="select-function-step">
    <p class="step-intro">O que você quer fazer com {{ fileCount }} arquivo(s)?</p>
    <div class="operation-list">
      <button
        v-for="op in availableOperations"
        :key="op.id"
        class="operation-card"
        @click="emit('continue', op.id)"
      >
        <div class="operation-label">{{ op.label }}</div>
        <div class="operation-description">{{ op.description }}</div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.select-function-step {
  max-width: 640px;
  margin: 0 auto;
}

.step-intro {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 16px;
  text-align: center;
}

.operation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.operation-card {
  text-align: left;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: 10px;
  padding: 12px 14px;
}

.operation-card:hover {
  border-color: var(--accent);
}

.operation-label {
  font-weight: 600;
  font-size: 13px;
}

.operation-description {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 2px;
}
</style>
