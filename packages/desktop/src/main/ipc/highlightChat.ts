import { ipcMain, BrowserWindow } from 'electron'
import {
  startSession,
  sendMessage,
  processCuts,
  removeHighlight,
  updateHighlightRange,
  listSessions,
  resumeSession,
  deleteSession
} from '../lib/highlightChatRunner'
import type {
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
  ChatSessionSummary,
  HighlightChatResumeResult
} from '../../shared/types'

export function registerHighlightChatIpc(): void {
  ipcMain.handle(
    'highlightChat:start',
    async (_event, request: HighlightChatStartRequest): Promise<HighlightChatStartResult> => {
      return startSession(request.jobId, request.options, request.agentId, request.objective)
    }
  )

  ipcMain.handle(
    'highlightChat:sendMessage',
    async (_event, request: HighlightChatSendRequest): Promise<HighlightChatSendResult> => {
      return sendMessage(request.sessionId, request.message)
    }
  )

  ipcMain.handle(
    'highlightChat:processCuts',
    async (event, request: HighlightChatCutRequest): Promise<HighlightChatCutResult> => {
      const window = BrowserWindow.fromWebContents(event.sender)

      return processCuts(request.sessionId, request.marginSeconds, request.exportOptions, (line) => {
        window?.webContents.send('highlightChat:log', {
          sessionId: request.sessionId,
          ...line,
          timestamp: new Date().toISOString()
        })
      })
    }
  )

  ipcMain.handle(
    'highlightChat:removeHighlight',
    async (_event, request: HighlightChatRemoveRequest): Promise<HighlightChatRemoveResult> => {
      return removeHighlight(request.sessionId, request.index)
    }
  )

  ipcMain.handle(
    'highlightChat:updateHighlight',
    async (_event, request: HighlightChatUpdateRequest): Promise<HighlightChatUpdateResult> => {
      return updateHighlightRange(request.sessionId, request.index, request.start, request.end)
    }
  )

  ipcMain.handle('highlightChat:list', async (): Promise<ChatSessionSummary[]> => {
    return listSessions()
  })

  ipcMain.handle('highlightChat:resume', async (_event, sessionId: string): Promise<HighlightChatResumeResult> => {
    return resumeSession(sessionId)
  })

  ipcMain.handle('highlightChat:delete', async (_event, sessionId: string): Promise<void> => {
    deleteSession(sessionId)
  })
}
