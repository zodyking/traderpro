import { and, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { brokerConnections, brokerSyncJobs } from '../../../db/schema'
import type { BrokerImportInput } from '../../../shared/schemas/broker'
import { useDb } from '../../utils/db'
import { syncAlpacaConnection } from './alpaca'
import { importCsv } from './service'
import { enqueueBrokerSyncJob } from './queue'

export async function resolveConnectionForSync(userId: string, input: BrokerImportInput) {
  const db = useDb()

  const [existing] = await db
    .select()
    .from(brokerConnections)
    .where(
      and(
        eq(brokerConnections.userId, userId),
        eq(brokerConnections.broker, input.broker),
        eq(brokerConnections.label, input.label),
      ),
    )
    .limit(1)

  if (existing) {
    return existing.id
  }

  const connectionId = uuidv7()
  await db.insert(brokerConnections).values({
    id: connectionId,
    userId,
    broker: input.broker,
    label: input.label,
    status: 'connected',
  })

  return connectionId
}

export type BrokerSyncJobStats = {
  import?: BrokerImportInput
  result?: Awaited<ReturnType<typeof importCsv>>
}

export async function enqueueBrokerSync(
  userId: string,
  connectionId: string,
  importInput?: BrokerImportInput,
) {
  const db = useDb()

  const [connection] = await db
    .select()
    .from(brokerConnections)
    .where(and(eq(brokerConnections.id, connectionId), eq(brokerConnections.userId, userId)))
    .limit(1)

  if (!connection) {
    throw createError({ statusCode: 404, statusMessage: 'Broker connection not found' })
  }

  const jobId = uuidv7()
  const stats: BrokerSyncJobStats = importInput ? { import: importInput } : {}

  await db.insert(brokerSyncJobs).values({
    id: jobId,
    connectionId,
    status: 'queued',
    stats,
  })

  await db
    .update(brokerConnections)
    .set({ status: 'syncing' })
    .where(eq(brokerConnections.id, connectionId))

  await enqueueBrokerSyncJob(jobId, userId, connectionId)

  return { jobId }
}

export async function processBrokerSync(jobId: string, userId: string, connectionId: string) {
  const db = useDb()

  const [job] = await db
    .select()
    .from(brokerSyncJobs)
    .where(and(eq(brokerSyncJobs.id, jobId), eq(brokerSyncJobs.connectionId, connectionId)))
    .limit(1)

  if (!job) {
    throw new Error(`Broker sync job ${jobId} not found`)
  }

  if (job.status === 'done') {
    return job.stats as BrokerSyncJobStats
  }

  await db
    .update(brokerSyncJobs)
    .set({ status: 'running' })
    .where(eq(brokerSyncJobs.id, jobId))

  try {
    const stats = job.stats as BrokerSyncJobStats
    let resultStats: BrokerSyncJobStats = { ...stats }

    const [connection] = await db
      .select()
      .from(brokerConnections)
      .where(eq(brokerConnections.id, connectionId))
      .limit(1)

    if (connection?.broker === 'alpaca') {
      const result = await syncAlpacaConnection(userId, connectionId)
      resultStats = { ...stats, result }
    }
    else if (stats.import) {
      const result = await importCsv(userId, stats.import)
      resultStats = { ...stats, result }
    }

    await db
      .update(brokerSyncJobs)
      .set({ status: 'done', stats: resultStats, error: null })
      .where(eq(brokerSyncJobs.id, jobId))

    await db
      .update(brokerConnections)
      .set({ status: 'connected', lastSyncAt: new Date() })
      .where(eq(brokerConnections.id, connectionId))

    return resultStats
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Broker sync failed'

    await db
      .update(brokerSyncJobs)
      .set({ status: 'failed', error: message })
      .where(eq(brokerSyncJobs.id, jobId))

    await db
      .update(brokerConnections)
      .set({ status: 'degraded' })
      .where(eq(brokerConnections.id, connectionId))

    throw error
  }
}

export async function getBrokerSyncJob(userId: string, jobId: string) {
  const db = useDb()

  const [row] = await db
    .select({
      job: brokerSyncJobs,
      connectionUserId: brokerConnections.userId,
    })
    .from(brokerSyncJobs)
    .innerJoin(brokerConnections, eq(brokerSyncJobs.connectionId, brokerConnections.id))
    .where(eq(brokerSyncJobs.id, jobId))
    .limit(1)

  if (!row || row.connectionUserId !== userId) {
    throw createError({ statusCode: 404, statusMessage: 'Broker sync job not found' })
  }

  return {
    id: row.job.id,
    connectionId: row.job.connectionId,
    status: row.job.status,
    stats: row.job.stats as BrokerSyncJobStats,
    error: row.job.error,
    createdAt: row.job.createdAt,
  }
}
