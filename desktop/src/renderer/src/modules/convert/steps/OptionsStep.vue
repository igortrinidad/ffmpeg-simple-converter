<script setup lang="ts">
import { getOperation } from '@shared/operations'
import type { ConversionOptionsInput, OperationId } from '@shared/types'
import ConversionOptionsForm from '../../../shared/components/ConversionOptionsForm.vue'
import HighlightOptionsForm, { type HighlightOptionsFormModel } from '../../../shared/components/HighlightOptionsForm.vue'
import { CUSTOM_MODEL } from '../../../shared/constants'

const props = defineProps<{
  operationId: OperationId
}>()

const conversionForm = defineModel<ConversionOptionsInput>('conversionForm', { required: true })
const highlightForm = defineModel<HighlightOptionsFormModel>('highlightForm', { required: true })

const emit = defineEmits<{
  continue: []
}>()

const operation = getOperation(props.operationId)

function canContinue(): boolean {
  if (operation.needsHighlightOptions) {
    const model = highlightForm.value.modelChoice === CUSTOM_MODEL ? highlightForm.value.customModel : highlightForm.value.modelChoice
    return !!model.trim() && !!highlightForm.value.prompt.trim() && highlightForm.value.marginSeconds >= 0
  }
  return true
}
</script>

<template>
  <div class="options-step">
    <ConversionOptionsForm v-if="operation.needsConversionOptions" v-model="conversionForm" />
    <HighlightOptionsForm v-if="operation.needsHighlightOptions" v-model="highlightForm" mode="full" />

    <button class="btn btn-primary continue-btn" :disabled="!canContinue()" @click="emit('continue')">
      Avançar →
    </button>
  </div>
</template>

<style scoped>
.options-step {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.continue-btn {
  padding: 11px;
  font-size: 14px;
}
</style>
