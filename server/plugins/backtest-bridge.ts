import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { runBacktest } from '../domains/backtest/service'

export default defineNitroPlugin((nitroApp) => {
  const { redisUrl } = useRuntimeConfig()
  if (!redisUrl) {
    console.warn('[backtest-bridge] REDIS_URL is not configured')
    return
  }

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null })
  const worker = new Worker(
    'backtest',
    async (job) => {
      const runId = job.data.runId as string
      if (!runId) {
        throw new Error('Backtest job missing runId')
      }
      await runBacktest(runId)
    },
    { connection: connection as never },
  )

  worker.on('failed', (job, error) => {
    console.error(`[backtest-bridge] job ${job?.id ?? 'unknown'} failed`, error)
  })

  console.log('[backtest-bridge] listening on queue: backtest')

  nitroApp.hooks.hook('close', async () => {
    await worker.close()
    await connection.quit()
  })
})
