import { Worker } from 'bullmq'
import IORedis from 'ioredis'

const QUEUE_NAMES = ['backtest', 'broker-sync', 'ai', 'scan'] as const

type QueueName = (typeof QUEUE_NAMES)[number]

function createConnection() {
  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
  return new IORedis(url, { maxRetriesPerRequest: null })
}

function createProcessor(queueName: QueueName) {
  return async (job: { id?: string; name: string }) => {
    console.log(`[worker:${queueName}] not implemented — job ${job.id ?? 'unknown'} (${job.name})`)
  }
}

function startWorkers(connection: IORedis) {
  const workers = QUEUE_NAMES.map((queueName) => {
    const worker = new Worker(queueName, createProcessor(queueName), {
      connection,
    })

    worker.on('failed', (job, error) => {
      console.error(`[worker:${queueName}] job ${job?.id ?? 'unknown'} failed`, error)
    })

    console.log(`[worker] listening on queue: ${queueName}`)
    return worker
  })

  return workers
}

async function main() {
  const connection = createConnection()
  const workers = startWorkers(connection)

  const shutdown = async (signal: string) => {
    console.log(`[worker] received ${signal}, shutting down...`)
    await Promise.all(workers.map(worker => worker.close()))
    await connection.quit()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  console.log('[worker] BullMQ workers started')
}

main().catch((error) => {
  console.error('[worker] failed to start', error)
  process.exit(1)
})
