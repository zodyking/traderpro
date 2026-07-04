import { z } from 'zod'
import { createAlert } from '../../domains/alerts/service'

const conditionSchema = z.any()

const createAlertSchema = z.object({
  symbolId: z.string().uuid().optional(),
  strategyVersionId: z.string().uuid().optional(),
  condition: z.object({
    hash: z.string(),
    root: conditionSchema,
  }),
  active: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = createAlertSchema.parse(await readBody(event))
  const alert = await createAlert(user.id, body)
  setResponseStatus(event, 201)
  return { alert }
})
