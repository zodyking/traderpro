import type { Job } from 'bullmq'
import { runScan } from '../server/domains/alerts/scan-service'

export async function processScanJob(job: Job<{ scanId: string }>) {
  const scanId = job.data.scanId
  if (!scanId) {
    throw new Error('Scan job missing scanId')
  }

  await runScan(scanId)
}
