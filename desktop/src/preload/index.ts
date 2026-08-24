import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  Config,
  AIProviderOption,
  JobRequest,
  JobEvent,
  JobLogLine,
  HistoryEntry,
  FfmpegStatus,
  CompressRequest,
  CompressResult,
  HighlightChatStartRequest,
  HighlightChatStartResult,
  HighlightChatSendRequest,
  HighlightChatSendResult,
  HighlightChatCutRequest,
  HighlightChatCutResult,
  HighlightChatRemoveRequest,
  HighlightChatRemoveResult,
  HighlightChatUpdateRequest,
  HighlightChatUpdateResult,
  HighlightChatLogLine,
  ChatSessionSummary,
  HighlightChatResumeResult,
  Agent,
  ScreenSource,
  ScreencastControlAction
} from '../shared/types'

const api = {
  ffmpeg: {
    check: (): Promise<FfmpegStatus> => ipcRenderer.invoke('ffmpeg:check')
  },

  compress: {
    run: (request: CompressRequest): Promise<CompressResult> => ipcRenderer.invoke('compress:run', request)
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
    },
    onLog: (callback: (line: JobLogLine) => void): (() => void) => {
      const listener = (_: unknown, line: JobLogLine) => callback(line)
      ipcRenderer.on('jobs:log', listener)
      return () => ipcRenderer.removeListener('jobs:log', listener)
    }
  },

  history: {
    list: (): Promise<HistoryEntry[]> => ipcRenderer.invoke('history:list'),
    clear: (): Promise<void> => ipcRenderer.invoke('history:clear'),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('history:remove', id)
  },

  highlightChat: {
    start: (request: HighlightChatStartRequest): Promise<HighlightChatStartResult> =>
      ipcRenderer.invoke('highlightChat:start', request),
    sendMessage: (request: HighlightChatSendRequest): Promise<HighlightChatSendResult> =>
      ipcRenderer.invoke('highlightChat:sendMessage', request),
    processCuts: (request: HighlightChatCutRequest): Promise<HighlightChatCutResult> =>
      ipcRenderer.invoke('highlightChat:processCuts', request),
    removeHighlight: (request: HighlightChatRemoveRequest): Promise<HighlightChatRemoveResult> =>
      ipcRenderer.invoke('highlightChat:removeHighlight', request),
    updateHighlight: (request: HighlightChatUpdateRequest): Promise<HighlightChatUpdateResult> =>
      ipcRenderer.invoke('highlightChat:updateHighlight', request),
    list: (): Promise<ChatSessionSummary[]> => ipcRenderer.invoke('highlightChat:list'),
    resume: (sessionId: string): Promise<HighlightChatResumeResult> => ipcRenderer.invoke('highlightChat:resume', sessionId),
    delete: (sessionId: string): Promise<void> => ipcRenderer.invoke('highlightChat:delete', sessionId),
    onLog: (callback: (line: HighlightChatLogLine) => void): (() => void) => {
      const listener = (_: unknown, line: HighlightChatLogLine) => callback(line)
      ipcRenderer.on('highlightChat:log', listener)
      return () => ipcRenderer.removeListener('highlightChat:log', listener)
    }
  },

  agents: {
    list: (): Promise<Agent[]> => ipcRenderer.invoke('agents:list'),
    get: (id: string): Promise<Agent | null> => ipcRenderer.invoke('agents:get', id),
    save: (input: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Agent> =>
      ipcRenderer.invoke('agents:save', input),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('agents:delete', id)
  },

  screencast: {
    listSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke('screencast:listSources'),
    saveRawRecording: (buffer: ArrayBuffer): Promise<string> => ipcRenderer.invoke('screencast:saveRawRecording', buffer),
    openControlWindow: (): Promise<void> => ipcRenderer.invoke('screencast:openControlWindow'),
    closeControlWindow: (): Promise<void> => ipcRenderer.invoke('screencast:closeControlWindow'),
    sendControlAction: (action: ScreencastControlAction): void => {
      ipcRenderer.send('screencast:controlAction', action)
    },
    onControlAction: (callback: (action: ScreencastControlAction) => void): (() => void) => {
      const listener = (_: unknown, action: ScreencastControlAction) => callback(action)
      ipcRenderer.on('screencast:controlAction', listener)
      return () => ipcRenderer.removeListener('screencast:controlAction', listener)
    }
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
