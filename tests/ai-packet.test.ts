import { describe, expect, it } from 'vitest'
import { buildPrompt, getSystemPrompt, parseAIResult } from '../server/domains/ai/prompt'
import type { AIReviewPacket } from '../shared/types/ai'

const mockPacket: AIReviewPacket = {
  userProfile: {
    experienceLevel: 'developing',
    assetClasses: ['stock'],
    riskLimits: { maxRiskPerTrade: 0.01 },
  },
  strategy: {
    name: 'Trend Pullback',
    version: 3,
    rules: {
      signals: [
        {
          id: 's1',
          name: 'EMA Crossover Entry',
          kind: 'entry_long',
          logic: 'all',
          conditions: [
            {
              type: 'crossover',
              a: { indicator: 'ema', params: { period: 20 } },
              b: { indicator: 'ema', params: { period: 50 } },
              direction: 'above',
            },
            {
              type: 'indicator_compare',
              left: { indicator: 'rsi', params: { period: 14 } },
              op: 'lt',
              right: 60,
            },
          ],
        },
        {
          id: 's2',
          name: 'RSI Exit',
          kind: 'exit',
          logic: 'any',
          conditions: [
            {
              type: 'indicator_compare',
              left: { indicator: 'rsi', params: { period: 14 } },
              op: 'gt',
              right: 70,
            },
          ],
        },
      ],
    },
    riskModel: {
      stopLoss: { type: 'atr', value: 2 },
      takeProfit: { type: 'r_multiple', value: 2 },
      sizingMethod: 'risk_per_trade',
      maxRiskPerTrade: 0.01,
    },
    assumptions: {
      slippage: { type: 'percent', value: 0.001 },
      fees: { type: 'percent', value: 0.001 },
    },
  },
  testResults: {
    metrics: {
      tradeCount: 48,
      winRate: 0.52,
      profitFactor: 1.8,
      expectancy: 125.5,
      totalReturn: 0.142,
      cagr: 0.138,
      maxDrawdown: 0.087,
      sharpe: 1.12,
      sortino: 1.54,
    },
    equitySummary: {
      startEquity: 10000,
      endEquity: 11420,
      peakEquity: 11800,
      troughEquity: 9200,
    },
    tradeDistribution: {
      wins: 25,
      losses: 23,
      avgWin: 310,
      avgLoss: -145,
    },
    regimeBreakdown: {
      trending: { trades: 30, winRate: 0.6, expectancy: 200 },
      ranging: { trades: 18, winRate: 0.39, expectancy: -50 },
    },
  },
  dataQuality: {
    source: 'tradingview',
    gaps: 0,
    warnings: [],
  },
  requestedReviewType: 'strategy',
}

describe('AI packet prompt builder', () => {
  it('buildPrompt includes strategy name and version', () => {
    const prompt = buildPrompt(mockPacket)
    expect(prompt).toContain('Trend Pullback')
    expect(prompt).toContain('v3')
  })

  it('buildPrompt includes backtest metrics', () => {
    const prompt = buildPrompt(mockPacket)
    expect(prompt).toContain('48')
    expect(prompt).toContain('52.0%')
    expect(prompt).toContain('1.80')
    expect(prompt).toContain('14.20%')
    expect(prompt).toContain('8.70%')
  })

  it('buildPrompt includes user profile info', () => {
    const prompt = buildPrompt(mockPacket)
    expect(prompt).toContain('developing')
    expect(prompt).toContain('stock')
  })

  it('buildPrompt includes signal details', () => {
    const prompt = buildPrompt(mockPacket)
    expect(prompt).toContain('EMA Crossover Entry')
    expect(prompt).toContain('entry_long')
    expect(prompt).toContain('RSI Exit')
  })

  it('buildPrompt includes risk model details', () => {
    const prompt = buildPrompt(mockPacket)
    expect(prompt).toContain('atr')
    expect(prompt).toContain('risk_per_trade')
  })

  it('buildPrompt includes regime breakdown', () => {
    const prompt = buildPrompt(mockPacket)
    expect(prompt).toContain('25W')
    expect(prompt).toContain('23L')
  })

  it('buildPrompt handles missing testResults gracefully', () => {
    const packetNoResults: AIReviewPacket = { ...mockPacket, testResults: undefined }
    const prompt = buildPrompt(packetNoResults)
    expect(prompt).not.toContain('Backtest Results')
    expect(prompt).toContain('Trend Pullback')
  })

  it('buildPrompt handles missing strategy gracefully', () => {
    const packetNoStrategy: AIReviewPacket = {
      ...mockPacket,
      strategy: undefined,
      testResults: undefined,
    }
    const prompt = buildPrompt(packetNoStrategy)
    expect(prompt).toContain('developing')
    expect(prompt).not.toContain('Strategy:')
  })

  it('buildPrompt includes data quality warnings when present', () => {
    const packetWithWarnings: AIReviewPacket = {
      ...mockPacket,
      dataQuality: { source: 'tradingview', gaps: 3, warnings: ['small_sample', 'gaps_detected'] },
    }
    const prompt = buildPrompt(packetWithWarnings)
    expect(prompt).toContain('small_sample')
    expect(prompt).toContain('gaps_detected')
  })

  it('getSystemPrompt returns a non-empty system prompt', () => {
    const prompt = getSystemPrompt()
    expect(prompt.length).toBeGreaterThan(100)
    expect(prompt).toContain('JSON')
  })
})

describe('parseAIResult', () => {
  it('parses well-formed JSON result', () => {
    const input = JSON.stringify({
      observations: ['Trade count is adequate for analysis.'],
      risks: ['Max drawdown near threshold.'],
      strengths: ['Consistent profit factor above 1.5.'],
      actions: ['Extend test period to 5 years.'],
    })
    const result = parseAIResult(input)
    expect(result.observations).toHaveLength(1)
    expect(result.risks).toHaveLength(1)
    expect(result.strengths).toHaveLength(1)
    expect(result.actions).toHaveLength(1)
    expect(result.observations?.[0]).toContain('adequate')
  })

  it('extracts JSON embedded in prose', () => {
    const input = `Here is my review:\n\n${JSON.stringify({
      observations: ['Signal logic is clear.'],
      risks: [],
      strengths: ['Good risk management.'],
      actions: ['Run on more symbols.'],
    })}\n\nEnd of review.`
    const result = parseAIResult(input)
    expect(result.observations?.[0]).toBe('Signal logic is clear.')
  })

  it('handles malformed JSON gracefully', () => {
    const result = parseAIResult('this is not json at all')
    expect(result.observations).toBeDefined()
    expect(result.observations?.length).toBeGreaterThan(0)
  })

  it('handles empty text gracefully', () => {
    const result = parseAIResult('')
    expect(result).toBeDefined()
    expect(result.observations).toBeDefined()
  })

  it('handles partial JSON with missing keys', () => {
    const input = JSON.stringify({ observations: ['Only observations here.'] })
    const result = parseAIResult(input)
    expect(result.observations).toHaveLength(1)
    expect(result.risks).toHaveLength(0)
    expect(result.strengths).toHaveLength(0)
    expect(result.actions).toHaveLength(0)
  })
})

describe('AI review packet shape', () => {
  it('packet has required top-level keys', () => {
    expect(mockPacket.userProfile).toBeDefined()
    expect(mockPacket.dataQuality).toBeDefined()
    expect(mockPacket.requestedReviewType).toBe('strategy')
  })

  it('packet strategy section has correct structure', () => {
    const strategy = mockPacket.strategy!
    expect(strategy.name).toBe('Trend Pullback')
    expect(strategy.version).toBe(3)
    expect(strategy.rules.signals).toHaveLength(2)
    expect(strategy.riskModel.stopLoss?.type).toBe('atr')
  })

  it('packet testResults has correct metrics', () => {
    const metrics = mockPacket.testResults!.metrics
    expect(metrics.tradeCount).toBe(48)
    expect(metrics.winRate).toBeCloseTo(0.52)
    expect(metrics.profitFactor).toBeCloseTo(1.8)
    expect(metrics.maxDrawdown).toBeCloseTo(0.087)
  })

  it('trade distribution sums match trade count', () => {
    const dist = mockPacket.testResults!.tradeDistribution
    expect(dist.wins + dist.losses).toBe(mockPacket.testResults!.metrics.tradeCount)
  })
})
