export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface LogEntry {
  level: LogLevel
  timestamp: string
  context: string
  message: string
  meta?: Record<string, unknown>
}

async function captureInSentry(
  error: unknown,
  context: string,
  meta?: Record<string, unknown>,
) {
  if (!process.env.SENTRY_DSN) return

  try {
    const Sentry = await import('@sentry/node')
    if (error instanceof Error) {
      Sentry.captureException(error, {
        tags: { context },
        extra: meta,
      })
      return
    }

    Sentry.captureMessage(String(error), {
      level: 'error',
      tags: { context },
      extra: meta,
    })
  }
  catch {
    // Sentry is best-effort
  }
}

function writeLog(entry: LogEntry) {
  const line = JSON.stringify(entry)

  switch (entry.level) {
    case 'error':
      console.error(line)
      break
    case 'warn':
      console.warn(line)
      break
    default:
      console.log(line)
  }
}

export function logStructured(
  level: LogLevel,
  context: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    context,
    message,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  }

  writeLog(entry)
}

export function logError(context: string, error: unknown, meta?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  logStructured('error', context, message, {
    ...meta,
    ...(stack ? { stack } : {}),
  })

  void captureInSentry(error, context, meta)
}
