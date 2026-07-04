import type { AIReviewPacket, AIReviewResult } from '../../../shared/types/ai'

const JSON_SCHEMA_INSTRUCTION = `
Respond ONLY with a valid JSON object matching this exact schema:
{
  "observations": ["string", ...],
  "risks": ["string", ...],
  "strengths": ["string", ...],
  "actions": ["string", ...]
}

Each array should contain 2-5 items. Each item must be a single sentence under 120 characters. Do not include any text outside the JSON object.`

const SYSTEM_PROMPT = `You are a systematic trading coach and quantitative analyst. Your role is to critically evaluate trading strategies and execution quality using objective, evidence-based analysis.

When reviewing, apply the following framework:
1. Statistical validity - is the sample size sufficient? Are results likely to be due to chance?
2. Risk management - are position sizing, stop losses, and drawdown controls adequate?
3. Strategy logic - are the entry/exit signals logically coherent and testable?
4. Regime sensitivity - does the strategy account for different market environments?
5. Execution realism - are assumptions about slippage, fees, and fill rates realistic?

Be direct, concise, and actionable. Do not flatter. Identify both genuine strengths and material risks.
${JSON_SCHEMA_INSTRUCTION}`

const RISK_REFEREE_PROMPT = `You are a risk referee for active traders. Your sole focus is capital preservation, position sizing discipline, and adherence to risk limits.

Evaluate:
1. Stop-loss placement and whether it was honored
2. Position size relative to account risk tolerance
3. Correlation and concentration across open exposure
4. Drawdown state and whether trading should continue
5. Emotional triggers that led to risk rule violations

Be firm and protective. Flag any breach of prudent risk management immediately.
${JSON_SCHEMA_INSTRUCTION}`

const MARKET_EXPLANATION_PROMPT = `You are a market structure analyst explaining price action context for a specific trade.

Focus on:
1. What market conditions likely drove the move (trend, range, volatility, session)
2. How planned levels relate to observable structure (support, resistance, VWAP, gaps)
3. Whether the execution timing aligned with typical liquidity windows
4. Alternative interpretations of the same price action
5. What context a trader should gather before similar setups

Be educational and objective. Avoid hindsight bias — explain what was knowable at entry.
${JSON_SCHEMA_INSTRUCTION}`

const JOURNAL_ASSISTANT_PROMPT = `You are a supportive trading journal assistant. The trader is reflecting on a single journal entry and wants a conversational, single-turn response grounded in their notes.

Focus on:
1. Acknowledging what they did well and what they are wrestling with
2. Connecting emotions, setup, and execution to their stated plan
3. One or two practical questions they can answer in their next entry
4. Gentle accountability without harsh judgment
5. A concise takeaway they can remember before the next similar setup

Write like a thoughtful coach in a brief conversation — warm, direct, and specific to their journal context.
${JSON_SCHEMA_INSTRUCTION}`

const LESSON_PROMPT = `You are a trading educator turning journal mistakes into actionable lessons.

Focus on:
1. Root cause behind each tagged mistake (process vs outcome)
2. A concrete rule or checklist item to prevent recurrence
3. How the mistake connects to the trader's experience level
4. One drill or paper-trade exercise to reinforce the lesson
5. When this mistake is most dangerous (market regime, emotional state)

Be supportive but honest. Turn errors into durable habits.
${JSON_SCHEMA_INSTRUCTION}`

export function getSystemPrompt(reviewType?: string): string {
  switch (reviewType) {
    case 'risk':
      return RISK_REFEREE_PROMPT
    case 'market':
      return MARKET_EXPLANATION_PROMPT
    case 'lesson':
      return LESSON_PROMPT
    case 'assistant':
      return JOURNAL_ASSISTANT_PROMPT
    default:
      return SYSTEM_PROMPT
  }
}

function formatRecordFields(record: Record<string, unknown> | undefined, labels: Record<string, string>): string[] {
  if (!record) return []
  const lines: string[] = []
  for (const [key, label] of Object.entries(labels)) {
    const value = record[key]
    if (value != null && value !== '') {
      lines.push(`  - ${label}: ${value}`)
    }
  }
  return lines
}

export function buildPrompt(packet: AIReviewPacket): string {
  const lines: string[] = []

  lines.push(`## Review Request: ${packet.requestedReviewType.toUpperCase()}`)
  lines.push('')
  lines.push(`**Trader profile:** ${packet.userProfile.experienceLevel} experience`)

  if (packet.userProfile.assetClasses.length > 0) {
    lines.push(`**Asset classes:** ${packet.userProfile.assetClasses.join(', ')}`)
  }

  if (packet.tradeEntry) {
    const t = packet.tradeEntry
    lines.push('')
    lines.push('## Trade Journal Entry')
    if (t.side) lines.push(`**Side:** ${t.side}`)
    if (t.setupTag) lines.push(`**Setup tag:** ${t.setupTag}`)
    if (t.emotion) lines.push(`**Emotion:** ${t.emotion}`)
    if (t.mistakes && t.mistakes.length > 0) {
      lines.push(`**Mistakes:** ${t.mistakes.join(', ')}`)
    }
    if (t.openedAt) lines.push(`**Opened:** ${t.openedAt}`)
    if (t.closedAt) lines.push(`**Closed:** ${t.closedAt}`)

    const plannedLines = formatRecordFields(t.planned, {
      entry: 'Entry',
      stop: 'Stop',
      target: 'Target',
      size: 'Size',
      thesis: 'Thesis',
    })
    if (plannedLines.length > 0) {
      lines.push('')
      lines.push('**Planned:**')
      lines.push(...plannedLines)
    }

    const actualLines = formatRecordFields(t.actual, {
      entry: 'Entry',
      exit: 'Exit',
      size: 'Size',
    })
    if (actualLines.length > 0) {
      lines.push('')
      lines.push('**Actual:**')
      lines.push(...actualLines)
    }

    if (t.note) {
      lines.push('')
      lines.push(`**Notes:** ${t.note}`)
    }
  }

  if (packet.lessonContext) {
    lines.push('')
    lines.push('## Learning Lesson')
    lines.push(`**Title:** ${packet.lessonContext.title}`)
    lines.push(`**Stage:** ${packet.lessonContext.stage}`)
    lines.push(`**Source:** ${packet.lessonContext.source}`)
    lines.push(`**Duration:** ${packet.lessonContext.duration}`)
  }

  if (packet.marketContext) {
    lines.push('')
    lines.push('## Market Context')
    lines.push(`**Symbol:** ${packet.marketContext.symbol}`)
    if (packet.marketContext.exchange) {
      lines.push(`**Exchange:** ${packet.marketContext.exchange}`)
    }
  }

  if (packet.strategy) {
    const s = packet.strategy
    lines.push('')
    lines.push(`## Strategy: ${s.name} (v${s.version})`)
    lines.push(`**Signals:** ${s.rules.signals.length} signal(s) defined`)
    const signalSummary = s.rules.signals
      .map(sig => `  - ${sig.name} (${sig.kind}): ${sig.conditions.length} condition(s), logic=${sig.logic}`)
      .join('\n')
    lines.push(signalSummary)

    if (s.riskModel) {
      lines.push('')
      lines.push('**Risk model:**')
      if (s.riskModel.stopLoss) {
        lines.push(`  - Stop loss: ${s.riskModel.stopLoss.type} @ ${s.riskModel.stopLoss.value}`)
      }
      if (s.riskModel.takeProfit) {
        lines.push(`  - Take profit: ${s.riskModel.takeProfit.type} @ ${s.riskModel.takeProfit.value}`)
      }
      if (s.riskModel.sizingMethod) {
        lines.push(`  - Position sizing: ${s.riskModel.sizingMethod}`)
      }
      if (s.riskModel.maxRiskPerTrade != null) {
        lines.push(`  - Max risk per trade: ${(s.riskModel.maxRiskPerTrade * 100).toFixed(1)}%`)
      }
    }
  }

  if (packet.testResults) {
    const t = packet.testResults
    const m = t.metrics
    lines.push('')
    lines.push('## Backtest Results')
    lines.push(`- Trades: ${m.tradeCount}`)
    if (m.winRate != null) lines.push(`- Win rate: ${(m.winRate * 100).toFixed(1)}%`)
    if (m.profitFactor != null) lines.push(`- Profit factor: ${m.profitFactor.toFixed(2)}`)
    if (m.expectancy != null) lines.push(`- Expectancy: $${m.expectancy.toFixed(2)}`)
    if (m.totalReturn != null) lines.push(`- Total return: ${(m.totalReturn * 100).toFixed(2)}%`)
    if (m.cagr != null) lines.push(`- CAGR: ${(m.cagr * 100).toFixed(2)}%`)
    if (m.maxDrawdown != null) lines.push(`- Max drawdown: ${(m.maxDrawdown * 100).toFixed(2)}%`)
    if (m.sharpe != null) lines.push(`- Sharpe: ${m.sharpe.toFixed(2)}`)
    if (m.sortino != null) lines.push(`- Sortino: ${m.sortino.toFixed(2)}`)
    lines.push(`- Distribution: ${t.tradeDistribution.wins}W / ${t.tradeDistribution.losses}L`)
  }

  if (packet.brokerContext) {
    const b = packet.brokerContext
    lines.push('')
    lines.push('## Broker Context')
    lines.push(`- Recent trades: ${b.recentTrades.length}`)
    lines.push(`- Open positions: ${b.exposure.openPositions}`)
    lines.push(`- Current drawdown: ${(b.drawdownState.currentDrawdown * 100).toFixed(1)}%`)
    lines.push(`- Max drawdown: ${(b.drawdownState.maxDrawdown * 100).toFixed(1)}%`)
  }

  if (packet.dataQuality.warnings.length > 0) {
    lines.push('')
    lines.push(`**Data quality warnings:** ${packet.dataQuality.warnings.join(', ')}`)
  }

  return lines.join('\n')
}

export function parseAIResult(text: string): AIReviewResult {
  const trimmed = text.trim()
  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')

  if (jsonStart === -1 || jsonEnd === -1) {
    return { observations: [trimmed], risks: [], strengths: [], actions: [] }
  }

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>
    return {
      observations: Array.isArray(parsed.observations) ? parsed.observations as string[] : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks as string[] : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths as string[] : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions as string[] : [],
    }
  }
  catch {
    return { observations: ['Unable to parse AI response.'], risks: [], strengths: [], actions: [] }
  }
}
