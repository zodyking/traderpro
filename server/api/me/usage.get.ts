import { checkUsage, getUserPlan } from '../../domains/billing/entitlements'

const TRACKED_METRICS = ['backtestsPerMonth', 'aiCredits', 'scannerSymbols'] as const

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const plan = await getUserPlan(user.id)

  const usageEntries = await Promise.all(
    TRACKED_METRICS.map(async (metric) => {
      const { used, limit } = await checkUsage(user.id, metric)
      return [metric, { used, limit }] as const
    }),
  )

  const usage = Object.fromEntries(usageEntries) as Record<
    (typeof TRACKED_METRICS)[number],
    { used: number; limit: number }
  >

  return {
    plan: {
      id: plan.planId,
      label: plan.label,
    },
    usage,
  }
})
