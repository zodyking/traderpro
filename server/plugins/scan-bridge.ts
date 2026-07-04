import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { runScan } from '../domains/alerts/scan-service'

export default defineNitroPlugin((nitroApp) => {
  if (!process.env.SCAN_BRIDGE) {
    return
  }

  const { redisUrl } = useRuntimeConfig()
  if (!redisUrl) {
    console.warn('[scan-bridge] REDIS_URL is not configured')
    return
  }

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null })
  const worker = new Worker(
    'scan',
    async (job) => {
      const scanId = job.data.scanId as string
      if (!scanId) {
        throw new Error('Scan job missing scanId')
      }
      await runScan(scanId)
    },
    { connection: connection as never },
  )

  worker.on('failed', (job, error) => {
    console.error(`[scan-bridge] job ${job?.id ?? 'unknown'} failed`, error)
  })

  console.log('[scan-bridge] listening on queue: scan')

  nitroApp.hooks.hook('close', async () => {
    await worker.close()
    await connection.quit()
  })
})
