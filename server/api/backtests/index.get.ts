import { desc, eq } from 'drizzle-orm'
import { backtestRuns } from '../../../db/schema'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUserOrApiKey(event)
  const db = useDb()

  const runs = await db
    .select()
    .from(backtestRuns)
    .where(eq(backtestRuns.userId, user.id))
    .orderBy(desc(backtestRuns.queuedAt))
    .limit(20)

  return {
    runs: runs.map((run) => ({
      id: run.id,
      status: run.status,
      config: run.config,
      error: run.error,
      queuedAt: run.queuedAt,
      finishedAt: run.finishedAt,
      strategyVersionId: run.strategyVersionId,
    })),
  }
})
