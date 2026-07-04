import { listAlerts } from '../../domains/alerts/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const alertList = await listAlerts(user.id)
  return { alerts: alertList }
})
