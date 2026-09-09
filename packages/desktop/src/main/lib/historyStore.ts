import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { getConfigDirectory } from 'mediacript'
import type { HistoryEntry, HistoryOperation } from '../../shared/types'

const MAX_HISTORY_ENTRIES = 500

function getHistoryFilePath(): string {
  return path.join(getConfigDirectory(), 'desktop-history.json')
}

export function listHistory(): HistoryEntry[] {
  try {
    const filePath = getHistoryFilePath()
    if (!fs.existsSync(filePath)) return []
    const data = fs.readFileSync(filePath, 'utf-8')
    const entries = JSON.parse(data) as HistoryEntry[]
    return entries.sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime())
  } catch (error) {
    console.error('Error reading history:', error)
    return []
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    const configDir = getConfigDirectory()
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    fs.writeFileSync(getHistoryFilePath(), JSON.stringify(entries, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error saving history:', error)
  }
}

export function addHistoryEntry(entry: HistoryEntry): void {
  const entries = listHistory()
  entries.unshift(entry)
  saveHistory(entries.slice(0, MAX_HISTORY_ENTRIES))
}

/**
 * Records a run from a module that doesn't go through the job runner
 * (Comprimir, Screencast), so the History feed covers everything the app did
 * and not only the wizard jobs. The job runner writes its own entries, with
 * the per-step detail it already tracks.
 */
export function recordActivity(input: {
  operation: HistoryOperation
  operationLabel: string
  inputFile: string
  outputFiles: string[]
  startedAt: string
  error?: string
}): void {
  addHistoryEntry({
    id: randomUUID(),
    operation: input.operation,
    operationLabel: input.operationLabel,
    inputFile: input.inputFile,
    outputFiles: input.outputFiles,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    status: input.error ? 'failed' : 'completed',
    error: input.error
  })
}

export function removeHistoryEntry(id: string): void {
  const entries = listHistory().filter((entry) => entry.id !== id)
  saveHistory(entries)
}

export function clearHistory(): void {
  saveHistory([])
}
