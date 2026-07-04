import { z } from 'zod'
import { ruleAstSchema } from '#shared/schemas/strategy'
import { previewStrategySignals } from '../../domains/strategy/preview'

const previewSchema = z.object({
  symbolId: z.string().uuid(),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']).default('1h'),
  rules: ruleAstSchema,
})

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = previewSchema.parse(await readBody(event))
  return previewStrategySignals(body)
})
