import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  Config,
  AIProviderOption,
  JobRequest,
  JobEvent,
  HistoryEntry,
  FfmpegStatus
} from '../shared/types'

const api = {
  ffmpeg: {
    check: (): Promise<FfmpegStatus> => ipcRenderer.invoke('ffmpeg:check')
  },

  config: {
    get: (): Promise<Config> => ipcRenderer.invoke('config:get'),
    save: (values: Partial<Config>): Promise<Config> => ipcRenderer.invoke('config:save', values),
    getConfigDir: (): Promise<string> => ipcRenderer.invoke('config:getConfigDir'),
    listAIProviders: (): Promise<AIProviderOption[]> => ipcRenderer.invoke('config:listAIProviders')
  },

  files: {
    pickFiles: (): Promise<string[]> => ipcRenderer.invoke('files:pick'),
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('files:pickDirectory'),
    /** Resolves the real filesystem path for a File dragged into the window */
    getPathForFile: (file: File): string => webUtils.getPathForFile(file),
    openFile: (path: string): Promise<void> => ipcRenderer.invoke('files:openFile', path),
    revealInFolder: (path: string): Promise<void> => ipcRenderer.invoke('files:revealInFolder', path)
  },

  jobs: {
    run: (request: JobRequest): Promise<void> => ipcRenderer.invoke('jobs:run', request),
    onEvent: (callback: (event: JobEvent) => void): (() => void) => {
      const listener = (_: unknown, event: JobEvent) => callback(event)
      ipcRenderer.on('jobs:event', listener)
      return () => ipcRenderer.removeListener('jobs:event', listener)
    }
  },

  history: {
    list: (): Promise<HistoryEntry[]> => ipcRenderer.invoke('history:list'),
    clear: (): Promise<void> => ipcRenderer.invoke('history:clear'),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('history:remove', id)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
