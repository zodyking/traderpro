import { z } from 'zod'
import { updateAlert } from '../../domains/alerts/service'

const patchAlertSchema = z.object({
  active: z.boolean().optional(),
  condition: z
    .object({
      hash: z.string(),
      root: z.any(),
    })
    .optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const alertId = getRouterParam(event, 'id')!
  const body = patchAlertSchema.parse(await readBody(event))
  const alert = await updateAlert(user.id, alertId, body)
  return { alert }
})
