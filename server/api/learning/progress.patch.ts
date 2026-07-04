import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { learningProgress } from '../../../db/schema/workspace'
import { requireUser } from '../../utils/auth'
import { useDb } from '../../utils/db'

const patchSchema = z.object({
  completedLessons: z.array(z.string().min(1)).optional(),
  lessonId: z.string().min(1).optional(),
  complete: z.boolean().optional(),
}).refine(
  body => body.completedLessons !== undefined || body.lessonId !== undefined,
  { message: 'completedLessons or lessonId is required' },
)

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = patchSchema.parse(await readBody(event))
  const db = useDb()

  const [existing] = await db
    .select()
    .from(learningProgress)
    .where(eq(learningProgress.userId, user.id))
    .limit(1)

  let completedLessons = existing?.completedLessons ?? []

  if (body.completedLessons !== undefined) {
    completedLessons = body.completedLessons
  }
  else if (body.lessonId !== undefined) {
    const set = new Set(completedLessons)
    if (body.complete) {
      set.add(body.lessonId)
    }
    else {
      set.delete(body.lessonId)
    }
    completedLessons = [...set]
  }

  const [row] = await db
    .insert(learningProgress)
    .values({
      userId: user.id,
      completedLessons,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: learningProgress.userId,
      set: {
        completedLessons,
        updatedAt: new Date(),
      },
    })
    .returning()

  return {
    completedLessons: row!.completedLessons,
    updatedAt: row!.updatedAt.toISOString(),
  }
})
