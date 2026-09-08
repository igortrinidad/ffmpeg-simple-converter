import { reactive, readonly } from 'vue'
import type { MeetingSummary } from '@shared/types'

const state = reactive({
  meetings: [] as MeetingSummary[],
  loaded: false
})

async function load(): Promise<void> {
  state.meetings = await window.api.meetings.list()
  state.loaded = true
}

async function remove(id: string, removeFiles: boolean): Promise<void> {
  await window.api.meetings.delete(id, removeFiles)
  await load()
}

export function useMeetings() {
  return { state: readonly(state), load, remove }
}
