import { and, desc, eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { v7 as uuidv7 } from 'uuid'
import { alerts } from '../../../db/schema'
import type { CompiledCondition } from '../../../shared/types/strategy'
import { useDb } from '../../utils/db'

export function hashCondition(condition: CompiledCondition): string {
  const stable = JSON.stringify(condition.root, Object.keys(condition.root).sort())
  return createHash('sha256').update(stable).digest('hex').slice(0, 32)
}

export async function listAlerts(userId: string) {
  const db = useDb()
  return db
    .select()
    .from(alerts)
    .where(eq(alerts.userId, userId))
    .orderBy(desc(alerts.createdAt))
}

export async function createAlert(
  userId: string,
  input: {
    symbolId?: string
    strategyVersionId?: string
    condition: CompiledCondition
    active?: boolean
  },
) {
  const db = useDb()
  const id = uuidv7()
  const conditionHash = hashCondition(input.condition)

  const [alert] = await db
    .insert(alerts)
    .values({
      id,
      userId,
      symbolId: input.symbolId ?? null,
      strategyVersionId: input.strategyVersionId ?? null,
      condition: input.condition,
      conditionHash,
      active: input.active ?? true,
    })
    .returning()

  return alert!
}

export async function updateAlert(
  userId: string,
  alertId: string,
  patch: { active?: boolean; condition?: CompiledCondition },
) {
  const db = useDb()

  const [existing] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Alert not found' })
  }

  const updates: Partial<typeof alerts.$inferInsert> = {}
  if (patch.active !== undefined) updates.active = patch.active
  if (patch.condition !== undefined) {
    updates.condition = patch.condition
    updates.conditionHash = hashCondition(patch.condition)
  }

  const [updated] = await db
    .update(alerts)
    .set(updates)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .returning()

  return updated!
}

export async function deleteAlert(userId: string, alertId: string) {
  const db = useDb()

  const [existing] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Alert not found' })
  }

  await db
    .delete(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
}

export async function getActiveAlertsForUser(userId: string) {
  const db = useDb()
  return db
    .select()
    .from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.active, true)))
}

export async function markAlertFired(alertId: string) {
  const db = useDb()
  await db
    .update(alerts)
    .set({ lastFiredAt: new Date() })
    .where(eq(alerts.id, alertId))
}
