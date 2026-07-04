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

export function getScanQueue() {
  if (!queue) {
    queue = new Queue('scan', { connection: getConnection() as never })
  }
  return queue
}

export async function enqueueScanJob(scanId: string) {
  await getScanQueue().add('run', { scanId }, { jobId: scanId })
}

export async function closeScanQueue() {
  await queue?.close()
  await connection?.quit()
  queue = undefined
  connection = undefined
}
