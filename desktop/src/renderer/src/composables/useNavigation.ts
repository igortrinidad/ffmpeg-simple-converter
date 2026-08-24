import { reactive, readonly } from 'vue'

export type ModuleId = 'chat' | 'agents' | 'convert' | 'compress' | 'screencast' | 'history' | 'settings'

const state = reactive({
  active: 'chat' as ModuleId,
  /** Set by History's "Continuar conversa"/"Ver conversa" — consumed once by ChatFlow to reopen that session instead of starting a new one. */
  pendingChatResumeId: null as string | null
})

function go(module: ModuleId): void {
  state.active = module
}

function resumeChatSession(sessionId: string): void {
  state.pendingChatResumeId = sessionId
  state.active = 'chat'
}

function consumeChatResume(): string | null {
  const id = state.pendingChatResumeId
  state.pendingChatResumeId = null
  return id
}

export function useNavigation() {
  return { state: readonly(state), go, resumeChatSession, consumeChatResume }
}
