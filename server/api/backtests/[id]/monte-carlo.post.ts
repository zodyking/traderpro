import { backtestRunIdParamSchema, monteCarloSchema } from '#shared/schemas/backtest'
import { runMonteCarloForBacktest } from '../../../domains/backtest/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Backtest run id required' })
  }
  backtestRunIdParamSchema.parse({ id })

  const body = monteCarloSchema.parse(await readBody(event).catch(() => ({})))

  return runMonteCarloForBacktest(user.id, id, body.iterations)
})
