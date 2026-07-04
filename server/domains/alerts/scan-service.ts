import { and, desc, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { scanRuns } from '../../../db/schema'
import type { ScanRunConfig, ScanRunResult } from '../../../db/schema/scanner'
import { useDb } from '../../utils/db'
import { useRedis } from '../../utils/redis'
import { incrementUsageBy } from '../billing/entitlements'
import { trackEvent } from '../analytics/service'
import { enqueueScanJob } from './queue'
import { scanSymbols } from './scanner'
import type { ScanProgressEvent } from './types'

export async function publishScanResult(scanId: string, event: ScanProgressEvent) {
  const channel = `scanner.${scanId}.results`
  const payload = JSON.stringify(event)

  try {
    const redis = useRedis()
    await redis.publish(channel, payload)
    await redis.set(`scan:results:${scanId}`, payload)
  }
  catch {
    // best-effort
  }
}

async function assertScanOwnership(userId: string, scanId: string) {
  const db = useDb()
  const [run] = await db
    .select()
    .from(scanRuns)
    .where(and(eq(scanRuns.id, scanId), eq(scanRuns.userId, userId)))
    .limit(1)

  if (!run) {
    throw createError({ statusCode: 404, statusMessage: 'Scan run not found' })
  }

  return run
}

export async function enqueueScan(
  userId: string,
  config: ScanRunConfig,
): Promise<{ scanId: string }> {
  const scanId = uuidv7()
  const db = useDb()

  await db.insert(scanRuns).values({
    id: scanId,
    userId,
    status: 'queued',
    config,
  })

  await enqueueScanJob(scanId)
  await publishScanResult(scanId, { pct: 0, stage: 'queued' })

  return { scanId }
}

export async function runScan(scanId: string) {
  const db = useDb()
  const [run] = await db.select().from(scanRuns).where(eq(scanRuns.id, scanId)).limit(1)

  if (!run) {
    throw new Error(`Scan run ${scanId} not found`)
  }

  const config = run.config as ScanRunConfig

  try {
    await db.update(scanRuns).set({ status: 'running' }).where(eq(scanRuns.id, scanId))
    await publishScanResult(scanId, { pct: 5, stage: 'starting' })

    const result = await scanSymbols(
      run.userId,
      config.symbolIds,
      config.interval,
      async (progress) => {
        await publishScanResult(scanId, progress)
      },
    )

    if (result.denied) {
      await db.update(scanRuns).set({
        status: 'failed',
        error: result.deniedReason ?? 'Scan denied',
        finishedAt: new Date(),
      }).where(eq(scanRuns.id, scanId))
      await publishScanResult(scanId, { pct: 100, stage: 'failed' })
      return
    }

    const scanResult: ScanRunResult = {
      matches: result.matches,
      scannedAlerts: result.scannedAlerts,
      scannedSymbols: result.scannedSymbols,
    }

    await db.update(scanRuns).set({
      status: 'done',
      result: scanResult,
      finishedAt: new Date(),
    }).where(eq(scanRuns.id, scanId))

    if (result.scannedSymbols > 0) {
      await incrementUsageBy(run.userId, 'scannerSymbols', result.scannedSymbols)
    }

    await publishScanResult(scanId, { pct: 100, stage: 'done' })
    await trackEvent(run.userId, 'scan.complete', {
      scanId,
      matchCount: result.matches.length,
      scannedSymbols: result.scannedSymbols,
      scannedAlerts: result.scannedAlerts,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Scan failed'
    await db.update(scanRuns).set({
      status: 'failed',
      error: message,
      finishedAt: new Date(),
    }).where(eq(scanRuns.id, scanId))
    await publishScanResult(scanId, { pct: 100, stage: 'failed' })
    throw error
  }
}

export async function getScanStatus(userId: string, scanId: string) {
  const run = await assertScanOwnership(userId, scanId)
  return {
    id: run.id,
    status: run.status,
    config: run.config,
    result: run.result,
    error: run.error,
    queuedAt: run.queuedAt,
    finishedAt: run.finishedAt,
  }
}

export async function listScans(userId: string, limit = 20) {
  const db = useDb()
  const rows = await db
    .select()
    .from(scanRuns)
    .where(eq(scanRuns.userId, userId))
    .orderBy(desc(scanRuns.queuedAt))
    .limit(limit)

  return rows.map(run => ({
    id: run.id,
    status: run.status,
    config: run.config,
    matchCount: run.result?.matches.length ?? 0,
    scannedSymbols: run.result?.scannedSymbols ?? 0,
    error: run.error,
    queuedAt: run.queuedAt,
    finishedAt: run.finishedAt,
  }))
}
