import { reactive, readonly } from 'vue'
import type { RetryRequest } from '@shared/types'

const state = reactive({
  pending: null as RetryRequest | null
})

function setRetry(request: RetryRequest): void {
  state.pending = request
}

/** Reads and clears the pending retry request, so it's only applied once. */
function consumeRetry(): RetryRequest | null {
  const request = state.pending
  state.pending = null
  return request
}

export function useRetry() {
  return { state: readonly(state), setRetry, consumeRetry }
}
