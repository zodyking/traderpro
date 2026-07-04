import { listScans } from '../../domains/alerts/scan-service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return listScans(user.id)
})
