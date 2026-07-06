import { computed, ref, type ComputedRef } from 'vue'

/**
 * Generalizes the step-index/step-name bookkeeping every multi-step flow
 * (Chat, Convert) needs — mirrors what used to live inline in the old
 * WizardModal, but as a reusable composable since it's no longer just one component.
 */
export function useStepFlow(stepOrder: ComputedRef<string[]>) {
  const stepIndex = ref(0)
  const currentStep = computed(() => stepOrder.value[stepIndex.value])

  function goTo(step: string): void {
    const index = stepOrder.value.indexOf(step)
    if (index !== -1) stepIndex.value = index
  }

  function next(): void {
    if (stepIndex.value < stepOrder.value.length - 1) stepIndex.value++
  }

  function back(): void {
    if (stepIndex.value > 0) stepIndex.value--
  }

  function reset(): void {
    stepIndex.value = 0
  }

  return { stepIndex, currentStep, goTo, next, back, reset }
}
