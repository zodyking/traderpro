import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { executions } from '../../../db/schema'
import { useDb } from '../../utils/db'

const mapSymbolsSchema = z.object({
  mappings: z.array(
    z.object({
      rawSymbol: z.string().min(1),
      symbolId: z.string().uuid(),
    }),
  ).min(1),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = mapSymbolsSchema.parse(await readBody(event))
  const db = useDb()

  let updated = 0

  for (const { rawSymbol, symbolId } of body.mappings) {
    const rows = await db
      .update(executions)
      .set({ symbolId })
      .where(
        and(
          eq(executions.userId, user.id),
          eq(executions.rawSymbol, rawSymbol),
        ),
      )
      .returning({ id: executions.id })

    updated += rows.length
  }

  return { updated }
})
