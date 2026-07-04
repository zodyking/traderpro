import { and, eq, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { plans, subscriptions, usageCounters } from '../../../db/schema/billing'
import { useDb } from '../../utils/db'

export type PlanInfo = {
  planId: string
  label: string
  limits: Record<string, number>
}

const FREE_DEFAULTS: Record<string, number> = {
  backtestsPerMonth: 10,
  aiCredits: 5,
  scannerSymbols: 5,
}

function currentPeriod(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

export async function getUserPlan(userId: string): Promise<PlanInfo> {
  const db = useDb()

  const [sub] = await db
    .select({ plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
    .limit(1)

  if (sub) {
    return {
      planId: sub.plan.id,
      label: sub.plan.label,
      limits: (sub.plan.limits ?? {}) as Record<string, number>,
    }
  }

  return {
    planId: 'free',
    label: 'Free',
    limits: { ...FREE_DEFAULTS },
  }
}

export async function checkUsage(
  userId: string,
  metric: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const plan = await getUserPlan(userId)
  const limit = plan.limits[metric] ?? FREE_DEFAULTS[metric] ?? Infinity

  const db = useDb()
  const period = currentPeriod()

  const [counter] = await db
    .select()
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.metric, metric),
        eq(usageCounters.period, period),
      ),
    )
    .limit(1)

  const used = counter?.used ?? 0
  return { allowed: used < limit, used, limit }
}

export async function incrementUsage(userId: string, metric: string): Promise<void> {
  await incrementUsageBy(userId, metric, 1)
}

export async function incrementUsageBy(userId: string, metric: string, amount: number): Promise<void> {
  if (amount <= 0) return

  const db = useDb()
  const period = currentPeriod()

  await db
    .insert(usageCounters)
    .values({ userId, metric, period, used: amount })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.metric, usageCounters.period],
      set: { used: sql`${usageCounters.used} + ${amount}` },
    })
}

export async function checkAiCredits(
  userId: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  return checkUsage(userId, 'aiCredits')
}

export async function activateSubscription(
  userId: string,
  planId: string,
  stripeSubId: string,
): Promise<void> {
  const db = useDb()

  await db
    .insert(subscriptions)
    .values({
      id: uuidv7(),
      userId,
      planId,
      status: 'active',
      providerRef: stripeSubId,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        planId,
        status: 'active',
        providerRef: stripeSubId,
      },
    })
}
