import { getRequestIP } from 'h3'
import { z } from 'zod'
import { trackEvent } from '../../domains/analytics/service'

const bodySchema = z.object({
  event: z.string().min(1).max(120),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  const ip = getRequestIP(event, { xForwardedFor: true })

  await trackEvent(user.id, body.event, body.meta, ip)
  setResponseStatus(event, 204)
})
