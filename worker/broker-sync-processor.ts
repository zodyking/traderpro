import type { Job } from 'bullmq'
import { processBrokerSync } from '../server/domains/broker/sync-service'

export async function processBrokerSyncJob(job: Job<{ jobId: string, userId: string, connectionId: string }>) {
  const { jobId, userId, connectionId } = job.data
  if (!jobId || !userId || !connectionId) {
    throw new Error('Broker sync job missing jobId, userId, or connectionId')
  }

  await processBrokerSync(jobId, userId, connectionId)
}
