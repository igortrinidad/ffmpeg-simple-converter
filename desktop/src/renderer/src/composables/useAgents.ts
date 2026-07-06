import { reactive, readonly } from 'vue'
import type { Agent } from '@shared/types'
import { toPlain } from '../shared/toPlain'

const state = reactive({
  agents: [] as Agent[],
  loaded: false
})

async function load(): Promise<void> {
  state.agents = await window.api.agents.list()
  state.loaded = true
}

async function save(input: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Agent> {
  const agent = await window.api.agents.save(toPlain(input))
  await load()
  return agent
}

async function remove(id: string): Promise<void> {
  await window.api.agents.delete(id)
  await load()
}

export function useAgents() {
  return { state: readonly(state), load, save, remove }
}
