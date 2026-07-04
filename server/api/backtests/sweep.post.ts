import { parameterSweepSchema } from '#shared/schemas/backtest'
import { runParameterSweep } from '../../domains/backtest/sweep'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = parameterSweepSchema.parse(await readBody(event))

  return runParameterSweep({
    userId: user.id,
    strategyVersionId: body.strategyVersionId,
    symbolIds: body.symbolIds,
    dateRange: body.dateRange,
    capital: body.capital,
    interval: body.interval,
    stopLossValues: body.stopLossValues,
    realism: body.realism,
  })
})
