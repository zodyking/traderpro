import { updateStrategy } from '../../domains/strategy/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Strategy id required' })
  }

  await updateStrategy(user.id, id, { archivedAt: new Date() })

  setResponseStatus(event, 204)
  return null
})
