import { brokerExecutionsQuerySchema } from '#shared/schemas/broker'
import { listExecutions } from '../../domains/broker/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = brokerExecutionsQuerySchema.parse(getQuery(event))
  return listExecutions(user.id, query)
})
