import { v7 as uuidv7 } from 'uuid'
import type { CandleInterval } from '../../../shared/types/market'
import { dataQualityReports } from '../../../db/schema'
import { useDb } from '../../utils/db'

const INTERVAL_MS: Record<CandleInterval, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '1w': 7 * 24 * 60 * 60_000,
}

export type CandleGap = {
  from: Date
  to: Date
  missingBars: number
}

export function detectGaps(
  candles: Array<{ time: string | Date }>,
  interval: CandleInterval,
): CandleGap[] {
  if (candles.length < 2) return []

  const expectedMs = INTERVAL_MS[interval]
  const gaps: CandleGap[] = []

  for (let i = 1; i < candles.length; i++) {
    const prev = new Date(candles[i - 1]!.time)
    const curr = new Date(candles[i]!.time)
    const delta = curr.getTime() - prev.getTime()

    if (delta > expectedMs * 1.5) {
      const missingBars = Math.max(1, Math.round(delta / expectedMs) - 1)
      gaps.push({
        from: prev,
        to: curr,
        missingBars,
      })
    }
  }

  return gaps
}

export async function writeDataQualityReport(input: {
  symbolId: string
  interval: CandleInterval
  gaps: CandleGap[]
  rangeFrom: Date
  rangeTo: Date
}): Promise<void> {
  if (input.gaps.length === 0) return

  const db = useDb()
  await db.insert(dataQualityReports).values({
    id: uuidv7(),
    symbolId: input.symbolId,
    interval: input.interval,
    kind: 'gap',
    rangeFrom: input.rangeFrom,
    rangeTo: input.rangeTo,
    detail: {
      gapCount: input.gaps.length,
      gaps: input.gaps.map(gap => ({
        from: gap.from.toISOString(),
        to: gap.to.toISOString(),
        missingBars: gap.missingBars,
      })),
    },
  })
}

export async function analyzeCandleQuality(input: {
  symbolId: string
  interval: CandleInterval
  candles: Array<{ time: string | Date }>
}): Promise<{ gapCount: number }> {
  if (input.candles.length === 0) {
    return { gapCount: 0 }
  }

  const gaps = detectGaps(input.candles, input.interval)
  const rangeFrom = new Date(input.candles[0]!.time)
  const rangeTo = new Date(input.candles[input.candles.length - 1]!.time)

  await writeDataQualityReport({
    symbolId: input.symbolId,
    interval: input.interval,
    gaps,
    rangeFrom,
    rangeTo,
  })

  return { gapCount: gaps.length }
}
