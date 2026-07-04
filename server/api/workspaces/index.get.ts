import { listWorkspaces } from '../../domains/workspace/service'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const workspaces = await listWorkspaces(user.id)
  return { workspaces }
})
