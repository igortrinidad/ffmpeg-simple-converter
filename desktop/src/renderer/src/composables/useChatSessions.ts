import { reactive, readonly } from 'vue'
import type { ChatSessionSummary } from '@shared/types'

const state = reactive({
  sessions: [] as ChatSessionSummary[],
  loaded: false
})

async function load(): Promise<void> {
  state.sessions = await window.api.highlightChat.list()
  state.loaded = true
}

async function remove(id: string): Promise<void> {
  await window.api.highlightChat.delete(id)
  await load()
}

export function useChatSessions() {
  return { state: readonly(state), load, remove }
}
