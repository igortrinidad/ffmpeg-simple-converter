import { reactive, readonly } from 'vue'
import type { HistoryEntry } from '@shared/types'

const state = reactive({
  entries: [] as HistoryEntry[],
  loaded: false
})

async function load(): Promise<void> {
  state.entries = await window.api.history.list()
  state.loaded = true
}

async function remove(id: string): Promise<void> {
  await window.api.history.remove(id)
  await load()
}

async function clear(): Promise<void> {
  await window.api.history.clear()
  await load()
}

export function useHistory() {
  return { state: readonly(state), load, remove, clear }
}
