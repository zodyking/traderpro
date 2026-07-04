import type { Job } from 'bullmq'
import { runBacktest } from '../server/domains/backtest/service'

export async function processBacktestJob(job: Job<{ runId: string }>) {
  const runId = job.data.runId
  if (!runId) {
    throw new Error('Backtest job missing runId')
  }

  await runBacktest(runId)
}
