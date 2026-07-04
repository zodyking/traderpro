import type { Job } from 'bullmq'
import { completeAiReview } from '../server/domains/ai/service'

export async function processAiJob(job: Job<{ reviewId: string }>) {
  const reviewId = job.data.reviewId
  if (!reviewId) {
    throw new Error('AI job missing reviewId')
  }

  await completeAiReview(reviewId)
}
