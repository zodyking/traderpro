import { Queue } from 'bullmq'
import IORedis from 'ioredis'

let queue: Queue | undefined
let connection: IORedis | undefined

function getRedisUrl() {
  return process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
}

function getConnection() {
  if (!connection) {
    connection = new IORedis(getRedisUrl(), { maxRetriesPerRequest: null })
  }
  return connection
}

export function getBrokerSyncQueue() {
  if (!queue) {
    queue = new Queue('broker-sync', { connection: getConnection() as never })
  }
  return queue
}

export async function enqueueBrokerSyncJob(jobId: string, userId: string, connectionId: string) {
  await getBrokerSyncQueue().add('sync', { jobId, userId, connectionId }, { jobId })
}

export async function closeBrokerSyncQueue() {
  await queue?.close()
  await connection?.quit()
  queue = undefined
  connection = undefined
}
