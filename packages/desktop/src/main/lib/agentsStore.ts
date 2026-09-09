import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { getConfigDirectory } from 'mediacript'
import type { Agent } from '../../shared/types'

function getAgentsFilePath(): string {
  return path.join(getConfigDirectory(), 'agents.json')
}

export function listAgents(): Agent[] {
  try {
    const filePath = getAgentsFilePath()
    if (!fs.existsSync(filePath)) return []
    const data = fs.readFileSync(filePath, 'utf-8')
    const agents = JSON.parse(data) as Agent[]
    return agents.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch (error) {
    console.error('Error reading agents:', error)
    return []
  }
}

export function getAgent(id: string): Agent | null {
  return listAgents().find((agent) => agent.id === id) ?? null
}

function saveAgents(agents: Agent[]): void {
  const configDir = getConfigDirectory()
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
  fs.writeFileSync(getAgentsFilePath(), JSON.stringify(agents, null, 2), 'utf-8')
}

/** Creates a new agent (when `input.id` is absent) or updates an existing one in place. */
export function saveAgent(input: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Agent {
  const agents = listAgents()
  const now = new Date().toISOString()

  if (input.id) {
    const index = agents.findIndex((agent) => agent.id === input.id)
    if (index === -1) throw new Error(`Agente não encontrado: ${input.id}`)
    const updated: Agent = { ...agents[index], name: input.name, prompt: input.prompt, exportOptions: input.exportOptions, updatedAt: now }
    agents[index] = updated
    saveAgents(agents)
    return updated
  }

  const created: Agent = {
    id: randomUUID(),
    name: input.name,
    prompt: input.prompt,
    exportOptions: input.exportOptions,
    createdAt: now,
    updatedAt: now
  }
  agents.unshift(created)
  saveAgents(agents)
  return created
}

export function deleteAgent(id: string): void {
  const agents = listAgents().filter((agent) => agent.id !== id)
  saveAgents(agents)
}
