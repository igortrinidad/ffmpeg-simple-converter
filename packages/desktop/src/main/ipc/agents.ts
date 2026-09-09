import { ipcMain } from 'electron'
import { listAgents, getAgent, saveAgent, deleteAgent } from '../lib/agentsStore'
import type { Agent } from '../../shared/types'

export function registerAgentsIpc(): void {
  ipcMain.handle('agents:list', async (): Promise<Agent[]> => {
    return listAgents()
  })

  ipcMain.handle('agents:get', async (_event, id: string): Promise<Agent | null> => {
    return getAgent(id)
  })

  ipcMain.handle(
    'agents:save',
    async (_event, input: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Agent> => {
      return saveAgent(input)
    }
  )

  ipcMain.handle('agents:delete', async (_event, id: string): Promise<void> => {
    deleteAgent(id)
  })
}
