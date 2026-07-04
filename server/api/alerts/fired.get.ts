import { getFiredAlerts } from '../../domains/alerts/feed'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const alerts = await getFiredAlerts(user.id)
  return { alerts }
})
