import type { CandleContext } from '../strategy/compiler'
import { getCandles } from '../market-data/service'
import { checkUsage } from '../billing/entitlements'
import { queueAuthEmail, notifyAlertFiredForUser } from '../email/service'
import { getActiveAlertsForUser, markAlertFired } from './service'
import { evaluateCompiledCondition } from './evaluator'
import { useRedis } from '../../utils/redis'
import type { ScanMatch } from '../../../shared/types/scanner'
import type { ScanProgressEvent } from './types'

export type ScanResult = {
  matches: ScanMatch[]
  scannedAlerts: number
  scannedSymbols: number
  denied?: boolean
  deniedReason?: string
}

const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour between re-fires

/**
 * Scan active alerts for a user against the given symbol IDs.
 * Respects the scannerSymbols entitlement limit.
 */
export async function scanSymbols(
  userId: string,
  symbolIds?: string[],
  interval: string = '1d',
  onProgress?: (event: ScanProgressEvent) => void | Promise<void>,
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
  const nowMs = Date.now()

  const toDate = new Date()
  const fromDate = new Date(toDate)
  fromDate.setDate(fromDate.getDate() - 90)
  const from = fromDate.toISOString().split('T')[0]!
  const to = toDate.toISOString().split('T')[0]!

  for (let i = 0; i < capped.length; i++) {
    const symbolId = capped[i]!
    const pct = Math.round(10 + ((i + 1) / capped.length) * 85)
    await onProgress?.({ pct, stage: 'scanning', symbolId })

    let candleData: { candles: Array<{ time: string; open: number; high: number; low: number; close: number; volume?: number }> }
    try {
      candleData = await getCandles({ symbolId, interval: interval as Parameters<typeof getCandles>[0]['interval'], from, to })
    }
    catch {
      continue
    }

    if (candleData.candles.length === 0) continue

    const ctx: CandleContext = {
      times: candleData.candles.map(c => new Date(c.time)),
      open: candleData.candles.map(c => c.open),
      high: candleData.candles.map(c => c.high),
      low: candleData.candles.map(c => c.low),
      close: candleData.candles.map(c => c.close),
      volume: candleData.candles.map(c => c.volume ?? 0),
    }

    const symbolAlerts = [...globalAlerts, ...(alertsBySymbol.get(symbolId) ?? [])]

    for (const alert of symbolAlerts) {
      if (alert.lastFiredAt && nowMs - alert.lastFiredAt.getTime() < COOLDOWN_MS) {
        continue
      }

      const fired = evaluateCompiledCondition(alert.condition, ctx)
      if (fired) {
        const match: ScanMatch = {
          alertId: alert.id,
          symbolId,
          conditionHash: alert.conditionHash,
          firedAt: now,
        }
        matches.push(match)
        await markAlertFired(alert.id)
        queueAuthEmail(() => notifyAlertFiredForUser(userId, symbolId, now))
        await onProgress?.({ pct, stage: 'match', symbolId, match })
        try {
          const redis = useRedis()
          const payload = JSON.stringify({ alertId: alert.id, symbolId, firedAt: now })
          await redis.publish(`alerts.user.${userId}`, payload)
          await redis.lpush(`alerts.user.${userId}:recent`, payload)
          await redis.ltrim(`alerts.user.${userId}:recent`, 0, 49)
        }
        catch {
          // Redis publish is best-effort; don't fail the scan
        }
      }
    }
  }

  return {
    matches,
    scannedAlerts: activeAlerts.length,
    scannedSymbols: capped.length,
  }
}
