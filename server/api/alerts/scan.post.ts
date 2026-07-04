import { z } from 'zod'
import { scanSymbols } from '../../domains/alerts/scanner'

const scanBodySchema = z.object({
  symbolIds: z.array(z.string().uuid()).optional(),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = scanBodySchema.parse(await readBody(event))
  const result = await scanSymbols(user.id, body.symbolIds, body.interval ?? '1d')

  if (result.denied) {
    throw createError({ statusCode: 429, statusMessage: result.deniedReason })
  }

  return result
})
