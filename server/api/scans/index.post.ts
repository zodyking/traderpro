import { z } from 'zod'
import { enqueueScan } from '../../domains/alerts/scan-service'

const createScanSchema = z.object({
  symbolIds: z.array(z.string().uuid()).optional(),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = createScanSchema.parse(await readBody(event).catch(() => ({})))

  const { scanId } = await enqueueScan(user.id, {
    symbolIds: body.symbolIds,
    interval: body.interval ?? '1d',
  })

  setResponseStatus(event, 202)
  return { scanId }
})
