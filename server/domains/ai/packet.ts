import { and, desc, eq } from 'drizzle-orm'
import { backtestMetrics, backtestRuns, executions, journalEntries, strategies, strategyVersions, users } from '../../../db/schema'
import type { AIReviewPacket } from '../../../shared/types/ai'
import type { AIReviewTargetType } from '../../../shared/schemas/ai'
import { useDb } from '../../utils/db'

interface PacketBuildOptions {
  targetType: AIReviewTargetType
  targetId: string
  reviewType?: AIReviewTargetType
}

function parseNumeric(value: string | null | undefined): number | undefined {
  if (value == null) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export async function buildAIReviewPacket(
  userId: string,
  options: PacketBuildOptions,
): Promise<AIReviewPacket> {
  const db = useDb()
  const { targetType, targetId, reviewType } = options
  const requestedReviewType = reviewType ?? targetType

  // Load user profile
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const userProfile = {
    experienceLevel: user.experience,
    assetClasses: [] as string[],
    riskLimits: {},
  }

  const packet: AIReviewPacket = {
    userProfile,
    dataQuality: { source: 'tradingview', gaps: 0, warnings: [] },
    requestedReviewType,
  }

  if (targetType === 'strategy') {
    // Load strategy version
    const [version] = await db
      .select()
      .from(strategyVersions)
      .where(eq(strategyVersions.id, targetId))
      .limit(1)

    if (!version) {
      throw createError({ statusCode: 404, statusMessage: 'Strategy version not found' })
    }

    // Verify ownership via strategy
    const [strategy] = await db
      .select()
      .from(strategies)
      .where(and(eq(strategies.id, version.strategyId), eq(strategies.userId, userId)))
      .limit(1)

    if (!strategy) {
      throw createError({ statusCode: 404, statusMessage: 'Strategy not found' })
    }

    userProfile.assetClasses = [strategy.assetClass]

    packet.strategy = {
      name: strategy.name,
      version: version.version,
      rules: version.rules,
      riskModel: version.riskModel,
      assumptions: version.assumptions ?? {},
    }

    // Load latest completed backtest for this strategy version
    const [run] = await db
      .select()
      .from(backtestRuns)
      .where(
        and(
          eq(backtestRuns.strategyVersionId, targetId),
          eq(backtestRuns.userId, userId),
          eq(backtestRuns.status, 'done'),
        ),
      )
      .orderBy(desc(backtestRuns.queuedAt))
      .limit(1)

    if (run) {
      const [metrics] = await db
        .select()
        .from(backtestMetrics)
        .where(eq(backtestMetrics.runId, run.id))
        .limit(1)

      if (metrics) {
        const totalReturn = parseNumeric(metrics.totalReturn)
        const tradeCount = metrics.tradeCount

        packet.testResults = {
          metrics: {
            tradeCount,
            winRate: parseNumeric(metrics.winRate),
            profitFactor: parseNumeric(metrics.profitFactor),
            expectancy: parseNumeric(metrics.expectancy),
            totalReturn,
            cagr: parseNumeric(metrics.cagr),
            maxDrawdown: parseNumeric(metrics.maxDrawdown),
            sharpe: parseNumeric(metrics.sharpe),
            sortino: parseNumeric(metrics.sortino),
          },
          equitySummary: {
            startEquity: 0,
            endEquity: totalReturn != null ? totalReturn : 0,
            peakEquity: 0,
            troughEquity: 0,
          },
          tradeDistribution: {
            wins: Math.round(tradeCount * (parseNumeric(metrics.winRate) ?? 0)),
            losses: Math.round(tradeCount * (1 - (parseNumeric(metrics.winRate) ?? 0))),
            avgWin: parseNumeric(metrics.avgWin),
            avgLoss: parseNumeric(metrics.avgLoss),
          },
          regimeBreakdown: (metrics.regimeBreakdown as Record<string, { trades: number; expectancy?: number; winRate?: number }>) ?? {},
        }

        if (metrics.qualityWarnings.length > 0) {
          packet.dataQuality.warnings = metrics.qualityWarnings
        }
      }
    }
  }

  if (targetType === 'trade') {
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, targetId), eq(journalEntries.userId, userId)))
      .limit(1)

    if (!entry) {
      throw createError({ statusCode: 404, statusMessage: 'Journal entry not found' })
    }

    packet.tradeEntry = {
      id: entry.id,
      side: entry.side,
      setupTag: entry.setupTag,
      planned: entry.planned,
      actual: entry.actual,
      emotion: entry.emotion,
      mistakes: entry.mistakes,
      note: entry.note,
      openedAt: entry.openedAt?.toISOString(),
      closedAt: entry.closedAt?.toISOString(),
    }
    packet.dataQuality = { source: 'journal', gaps: 0, warnings: [] }
  }

  if (targetType === 'trade' || targetType === 'risk') {
    // Load recent broker executions
    const recentExecs = await db
      .select()
      .from(executions)
      .where(eq(executions.userId, userId))
      .orderBy(desc(executions.executedAt))
      .limit(20)

    packet.brokerContext = {
      recentTrades: recentExecs.map(exec => ({
        symbol: exec.rawSymbol,
        side: exec.side === 'buy' ? 'long' : 'short',
        pnl: undefined,
        executedAt: exec.executedAt.toISOString(),
      })),
      exposure: {
        openPositions: 0,
        grossExposure: 0,
        netExposure: 0,
      },
      drawdownState: {
        currentDrawdown: 0,
        maxDrawdown: 0,
      },
    }
  }

  return packet
}
