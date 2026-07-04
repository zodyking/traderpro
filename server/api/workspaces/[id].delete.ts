import { deleteWorkspace } from '../../domains/workspace/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Workspace id required' })
  }

  await deleteWorkspace(user.id, id)
  return { ok: true }
})
