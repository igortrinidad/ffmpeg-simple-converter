import { inspect } from 'util'

export type ConsoleLogLevel = 'log' | 'warn' | 'error' | 'progress'

export interface ConsoleLogLine {
  level: ConsoleLogLevel
  text: string
}

function stringifyArg(arg: unknown): string {
  return typeof arg === 'string' ? arg : inspect(arg, { depth: 2 })
}

/**
 * The mediacript library reports what it's doing (ffmpeg steps, AI provider
 * retries/fallbacks, transcription progress, ...) via plain `console.log`/`warn`/
 * `error` calls scattered across the codebase — there's no structured event for
 * any of it. Rather than threading a logger through every call site, this
 * temporarily mirrors those calls (plus ffmpeg's raw progress writes to stdout)
 * to `onLine`, so the desktop UI can show the user what's happening live during
 * a job. Restores the originals when the returned function is called.
 */
export function captureConsole(onLine: (line: ConsoleLogLine) => void): () => void {
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error
  const originalStdoutWrite = process.stdout.write.bind(process.stdout)

  function emit(level: ConsoleLogLevel, args: unknown[]): void {
    const text = args.map(stringifyArg).join(' ').trim()
    if (text) onLine({ level, text })
  }

  console.log = (...args: unknown[]) => {
    originalLog(...args)
    emit('log', args)
  }
  console.warn = (...args: unknown[]) => {
    originalWarn(...args)
    emit('warn', args)
  }
  console.error = (...args: unknown[]) => {
    originalError(...args)
    emit('error', args)
  }

  // FFmpeg's progress bar is written directly to stdout as repeated `\r<line>`
  // chunks (not through console.log). Throttled, since it updates several times
  // a second and forwarding every single one would flood the UI.
  //
  // console.log/info also write to stdout under the hood, always terminated by
  // "\n" — checking for that distinguishes them from ffmpeg's writes (which use
  // "\r" instead) so console output doesn't get double-reported here too.
  let lastProgressAt = 0
  process.stdout.write = ((chunk: any, ...rest: any[]) => {
    const raw = typeof chunk === 'string' ? chunk : chunk?.toString?.() ?? ''
    if (!raw.endsWith('\n')) {
      const text = raw.replace(/\r/g, '').trim()
      const now = Date.now()
      if (text && now - lastProgressAt > 400) {
        lastProgressAt = now
        onLine({ level: 'progress', text })
      }
    }
    return originalStdoutWrite(chunk, ...rest)
  }) as typeof process.stdout.write

  return () => {
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError
    process.stdout.write = originalStdoutWrite
  }
}
