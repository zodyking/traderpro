import type { CandleContext } from '../strategy/compiler'
import { getCandles } from '../market-data/service'
import { checkUsage } from '../billing/entitlements'
import { getActiveAlertsForUser, markAlertFired } from './service'
import { evaluateCompiledCondition } from './evaluator'

export type ScanMatch = {
  alertId: string
  symbolId: string
  conditionHash: string
  firedAt: string
}

export type ScanResult = {
  matches: ScanMatch[]
  scannedAlerts: number
  scannedSymbols: number
  denied?: boolean
  deniedReason?: string
}

/**
 * Scan active alerts for a user against the given symbol IDs.
 * Respects the scannerSymbols entitlement limit.
 */
export async function scanSymbols(
  userId: string,
  symbolIds?: string[],
  interval: string = '1d',
): Promise<ScanResult> {
  const entitlement = await checkUsage(userId, 'scannerSymbols')
  if (!entitlement.allowed) {
    return {
      matches: [],
      scannedAlerts: 0,
      scannedSymbols: 0,
      denied: true,
      deniedReason: `Scanner symbol limit reached (${entitlement.used}/${entitlement.limit})`,
    }
  }

  const activeAlerts = await getActiveAlertsForUser(userId)
  if (activeAlerts.length === 0) {
    return { matches: [], scannedAlerts: 0, scannedSymbols: 0 }
  }

  const alertsBySymbol = new Map<string | null, typeof activeAlerts>()
  for (const alert of activeAlerts) {
    const key = alert.symbolId ?? null
    const bucket = alertsBySymbol.get(key) ?? []
    bucket.push(alert)
    alertsBySymbol.set(key, bucket)
  }

  const globalAlerts = alertsBySymbol.get(null) ?? []

  const resolvedSymbolIds = symbolIds
    ?? [...new Set(activeAlerts.map(a => a.symbolId).filter(Boolean) as string[])]

  const capped = resolvedSymbolIds.slice(0, entitlement.limit)
  const matches: ScanMatch[] = []
  const now = new Date().toISOString()

  const toDate = new Date()
  const fromDate = new Date(toDate)
  fromDate.setDate(fromDate.getDate() - 90)
  const from = fromDate.toISOString().split('T')[0]!
  const to = toDate.toISOString().split('T')[0]!

  for (const symbolId of capped) {
    let candleData: { candles: Array<{ time: string; open: number; high: number; low: number; close: number; volume?: number }> }
    try {
      candleData = await getCandles({ symbolId, interval: interval as Parameters<typeof getCandles>[0]['interval'], from, to })
    }
    catch {
      continue
    }

    if (candleData.candles.length === 0) continue

    const ctx: CandleContext = {
      open: candleData.candles.map(c => c.open),
      high: candleData.candles.map(c => c.high),
      low: candleData.candles.map(c => c.low),
      close: candleData.candles.map(c => c.close),
      volume: candleData.candles.map(c => c.volume ?? 0),
    }

    const symbolAlerts = [...globalAlerts, ...(alertsBySymbol.get(symbolId) ?? [])]

    for (const alert of symbolAlerts) {
      const fired = evaluateCompiledCondition(alert.condition, ctx)
      if (fired) {
        matches.push({
          alertId: alert.id,
          symbolId,
          conditionHash: alert.conditionHash,
          firedAt: now,
        })
        await markAlertFired(alert.id)
      }
    }
  }

  return {
    matches,
    scannedAlerts: activeAlerts.length,
    scannedSymbols: capped.length,
  }
}
