import { getCalendarPnl } from '../../domains/broker/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { accountId } = getQuery(event)
  return getCalendarPnl(user.id, typeof accountId === 'string' ? accountId : undefined)
})
