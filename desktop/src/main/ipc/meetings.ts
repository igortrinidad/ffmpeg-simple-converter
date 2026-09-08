import { ipcMain, session, desktopCapturer, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { join } from 'path'
import { processMeeting, regenerateMinutes, askAboutMeeting, buildDetail } from '../lib/meetingRunner'
import {
  appendChunk,
  closeStreams,
  createMeeting,
  deleteMeeting,
  listMeetings,
  loadMeeting,
  saveMeeting
} from '../lib/meetingStore'
import type {
  MeetingAskRequest,
  MeetingAskResult,
  MeetingControlAction,
  MeetingControlWindowOptions,
  MeetingCreateRequest,
  MeetingDetail,
  MeetingPlatformSupport,
  MeetingRegenerateRequest,
  MeetingSummary,
  MeetingTrack
} from '../../shared/types'

let controlWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null

/**
 * Electron can only capture system audio by itself on Windows (`audio:
 * 'loopback'`, see the `Streams` docs in electron.d.ts). Elsewhere the user has
 * to route the output back in as a regular input device: a PulseAudio monitor
 * on Linux (already listed by `enumerateDevices`), or a virtual driver such as
 * BlackHole/Loopback on macOS.
 */
function describePlatformSupport(): MeetingPlatformSupport {
  if (process.platform === 'win32') {
    return {
      platform: process.platform,
      loopbackSupported: true,
      note: 'O áudio do sistema é capturado direto pelo app — nada a instalar.'
    }
  }

  if (process.platform === 'linux') {
    return {
      platform: process.platform,
      loopbackSupported: false,
      note: 'Escolha um dispositivo "Monitor of ..." na lista de áudio do sistema para capturar o som da reunião.'
    }
  }

  return {
    platform: process.platform,
    loopbackSupported: false,
    note: 'O macOS não permite capturar o som do sistema diretamente. Instale um driver virtual (ex.: BlackHole) e selecione-o como dispositivo de áudio do sistema.'
  }
}

/**
 * Serves `getDisplayMedia({ audio: true, video: true })` from the renderer with
 * the whole screen plus a loopback audio track. The recorder discards the video
 * track immediately — it only exists because Chromium won't hand out desktop
 * audio without a video request alongside it.
 */
function registerLoopbackHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => {
          callback({ video: sources[0], audio: 'loopback' })
        })
        .catch(() => {
          // No source available — resolving with nothing rejects the renderer's
          // getDisplayMedia promise, which falls back to mic-only recording.
          callback({})
        })
    },
    { useSystemPicker: false }
  )
}

function windowFromEvent(event: IpcMainInvokeEvent): BrowserWindow {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window) throw new Error('Nenhuma janela associada a este evento')
  return window
}

function createControlWindow(options: MeetingControlWindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: 300,
    height: 70,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })
  window.setAlwaysOnTop(true, 'screen-saver')

  const query = `mic=${options.micEnabled ? '1' : '0'}&sys=${options.systemAudioEnabled ? '1' : '0'}`
  if (process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/meeting-control?${query}`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/meeting-control?${query}` })
  }

  window.on('closed', () => {
    controlWindow = null
  })

  return window
}

export function registerMeetingsIpc(): void {
  registerLoopbackHandler()

  ipcMain.handle('meetings:platformSupport', (): MeetingPlatformSupport => describePlatformSupport())

  ipcMain.handle('meetings:create', async (_event, request: MeetingCreateRequest): Promise<string> => {
    const meeting = createMeeting({
      title: request.title.trim() || 'Reunião sem título',
      setup: request.setup,
      provider: request.provider,
      model: request.model,
      agentId: request.agentId,
      objective: request.objective
    })
    return meeting.id
  })

  // `send`, not `invoke`: chunks arrive every few seconds for the whole meeting
  // and the renderer has nothing to do with a reply — skipping the round trip
  // keeps the recorder from queueing up promises it never reads.
  ipcMain.on(
    'meetings:appendChunk',
    (_event, meetingId: string, track: MeetingTrack, chunk: ArrayBuffer): void => {
      try {
        appendChunk(meetingId, track, Buffer.from(chunk))
      } catch (error) {
        console.error('Falha ao gravar trecho da reunião:', error)
      }
    }
  )

  ipcMain.handle(
    'meetings:finishRecording',
    async (_event, meetingId: string, durationSeconds: number): Promise<void> => {
      await closeStreams(meetingId)
      const meeting = loadMeeting(meetingId)
      meeting.durationSeconds = Math.max(0, Math.round(durationSeconds))
      saveMeeting(meeting)
    }
  )

  ipcMain.handle('meetings:cancel', async (_event, meetingId: string): Promise<void> => {
    await closeStreams(meetingId)
    deleteMeeting(meetingId, true)
  })

  ipcMain.handle('meetings:process', async (event, meetingId: string): Promise<MeetingDetail> => {
    const window = BrowserWindow.fromWebContents(event.sender)

    return processMeeting(meetingId, {
      onLog: (line) => {
        window?.webContents.send('meetings:log', {
          meetingId,
          ...line,
          timestamp: new Date().toISOString()
        })
      },
      onProgress: (progress) => {
        window?.webContents.send('meetings:progress', { meetingId, ...progress })
      }
    })
  })

  ipcMain.handle('meetings:list', async (): Promise<MeetingSummary[]> => listMeetings())

  ipcMain.handle('meetings:get', async (_event, meetingId: string): Promise<MeetingDetail> => {
    return buildDetail(loadMeeting(meetingId))
  })

  ipcMain.handle(
    'meetings:delete',
    async (_event, meetingId: string, removeFiles: boolean): Promise<void> => {
      deleteMeeting(meetingId, removeFiles)
    }
  )

  ipcMain.handle(
    'meetings:regenerateMinutes',
    async (_event, request: MeetingRegenerateRequest): Promise<MeetingDetail> => {
      return regenerateMinutes(request.meetingId, request.instructions)
    }
  )

  ipcMain.handle('meetings:ask', async (_event, request: MeetingAskRequest): Promise<MeetingAskResult> => {
    return askAboutMeeting(request.meetingId, request.message)
  })

  ipcMain.handle(
    'meetings:openControlWindow',
    (event, options: MeetingControlWindowOptions): void => {
      // Unlike the screencast recorder, the main window stays visible — nothing
      // is being filmed, and the user may want the app in view during the call.
      mainWindow = windowFromEvent(event)
      controlWindow = createControlWindow(options)
    }
  )

  ipcMain.handle('meetings:closeControlWindow', (): void => {
    controlWindow?.close()
    controlWindow = null
  })

  ipcMain.on('meetings:controlAction', (_event, action: MeetingControlAction): void => {
    mainWindow?.webContents.send('meetings:controlAction', action)
  })
}
