export type TradingSession = 'premarket' | 'regular' | 'afterhours'

const SESSION_RANGES: Record<TradingSession, { start: number; end: number }> = {
  premarket: { start: 4 * 60, end: 9 * 60 + 30 },
  regular: { start: 9 * 60 + 30, end: 16 * 60 },
  afterhours: { start: 16 * 60, end: 20 * 60 },
}

function nyWeekday(date: Date): number {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  }).format(date)

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[day] ?? 0
}

function nyMinuteOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date)

  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

/**
 * Returns true when barTime falls inside a US equity session window (America/New_York).
 * Weekends are excluded for all sessions.
 */
export function isInSession(barTime: Date, session: TradingSession): boolean {
  const weekday = nyWeekday(barTime)
  if (weekday < 1 || weekday > 5) return false

  const minute = nyMinuteOfDay(barTime)
  const range = SESSION_RANGES[session]
  return minute >= range.start && minute < range.end
}
