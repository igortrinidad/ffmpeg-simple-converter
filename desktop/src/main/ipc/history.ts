import { ipcMain } from 'electron'
import { listHistory, removeHistoryEntry, clearHistory } from '../lib/historyStore'
import type { HistoryEntry } from '../../shared/types'

export function registerHistoryIpc(): void {
  ipcMain.handle('history:list', (): HistoryEntry[] => {
    return listHistory()
  })

  ipcMain.handle('history:remove', (_event, id: string): void => {
    removeHistoryEntry(id)
  })

  ipcMain.handle('history:clear', (): void => {
    clearHistory()
  })
}
