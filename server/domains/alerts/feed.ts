import { desc, eq } from 'drizzle-orm'
import { alerts } from '../../../db/schema'
import { useDb } from '../../utils/db'

export type FiredAlert = {
  id: string
  symbolId: string | null
  conditionSummary: string
  firedAt: string
  createdAt: string
}

function summariseCondition(condition: unknown): string {
  try {
    const c = condition as { root?: { type?: string; field?: string; op?: string; indicator?: string } }
    const root = c?.root
    if (!root) return 'Alert fired'

    switch (root.type) {
      case 'price_level':
        return `${root.field ?? 'price'} ${root.op ?? ''} level`
      case 'indicator_compare':
        return `${root.indicator ?? 'indicator'} compare`
      case 'crossover':
        return 'Crossover signal'
      case 'candle_pattern':
        return 'Candle pattern'
      case 'time_window':
        return 'Time window'
      default:
        return 'Alert fired'
    }
  }
  catch {
    return 'Alert fired'
  }
}

export async function getFiredAlerts(userId: string, limit = 50): Promise<FiredAlert[]> {
  const db = useDb()

  const rows = await db
    .select()
    .from(alerts)
    .where(eq(alerts.userId, userId))
    .orderBy(desc(alerts.lastFiredAt))
    .limit(limit)

  return rows
    .filter(r => r.lastFiredAt !== null)
    .map(r => ({
      id: r.id,
      symbolId: r.symbolId ?? null,
      conditionSummary: summariseCondition(r.condition),
      firedAt: r.lastFiredAt!.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }))
}
