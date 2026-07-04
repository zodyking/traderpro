import { v7 as uuidv7 } from 'uuid'
import { auditLogs } from '../../../db/schema'
import { useDb } from '../../utils/db'

export async function trackEvent(
  userId: string,
  event: string,
  meta: Record<string, unknown> = {},
  ip?: string | null,
) {
  const db = useDb()

  await db.insert(auditLogs).values({
    id: uuidv7(),
    userId,
    action: event,
    target: null,
    meta,
    ip: ip ?? null,
  })
}
