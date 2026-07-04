import { eq } from 'drizzle-orm'
import { learningProgress } from '../../../db/schema/workspace'
import { requireUser } from '../../utils/auth'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()

  const [row] = await db
    .select()
    .from(learningProgress)
    .where(eq(learningProgress.userId, user.id))
    .limit(1)

  return {
    completedLessons: row?.completedLessons ?? [],
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  }
})
