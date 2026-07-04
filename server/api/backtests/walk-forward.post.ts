import { walkForwardSchema } from '#shared/schemas/backtest'
import { runWalkForward, runWalkForwardFromRun } from '../../domains/backtest/walk-forward'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = walkForwardSchema.parse(await readBody(event))

  if (body.baseRunId) {
    return runWalkForwardFromRun(user.id, body.baseRunId, body.foldCount)
  }

  return runWalkForward({
    userId: user.id,
    strategyVersionId: body.strategyVersionId!,
    symbolIds: body.symbolIds!,
    dateRange: body.dateRange!,
    capital: body.capital,
    interval: body.interval,
    foldCount: body.foldCount,
    realism: body.realism,
  })
})
