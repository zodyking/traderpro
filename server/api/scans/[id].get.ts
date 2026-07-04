import { getScanStatus } from '../../domains/alerts/scan-service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const scanId = getRouterParam(event, 'id')
  if (!scanId) {
    throw createError({ statusCode: 400, statusMessage: 'Scan ID required' })
  }

  return getScanStatus(user.id, scanId)
})
