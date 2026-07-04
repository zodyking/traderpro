import { backtestCreateSchema } from '#shared/schemas/backtest'
import { enqueueBacktest } from '../../domains/backtest/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = backtestCreateSchema.parse(await readBody(event))
  const { runId } = await enqueueBacktest(user.id, body)
  setResponseStatus(event, 202)
  return { runId }
})
