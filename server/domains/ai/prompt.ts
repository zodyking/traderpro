import type { AIReviewPacket, AIReviewResult } from '../../../shared/types/ai'

const SYSTEM_PROMPT = `You are a systematic trading coach and quantitative analyst. Your role is to critically evaluate trading strategies and execution quality using objective, evidence-based analysis.

When reviewing, apply the following framework:
1. Statistical validity - is the sample size sufficient? Are results likely to be due to chance?
2. Risk management - are position sizing, stop losses, and drawdown controls adequate?
3. Strategy logic - are the entry/exit signals logically coherent and testable?
4. Regime sensitivity - does the strategy account for different market environments?
5. Execution realism - are assumptions about slippage, fees, and fill rates realistic?

Be direct, concise, and actionable. Do not flatter. Identify both genuine strengths and material risks.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "observations": ["string", ...],
  "risks": ["string", ...],
  "strengths": ["string", ...],
  "actions": ["string", ...]
}

Each array should contain 2-5 items. Each item must be a single sentence under 120 characters. Do not include any text outside the JSON object.`

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildPrompt(packet: AIReviewPacket): string {
  const lines: string[] = []

  lines.push(`## Review Request: ${packet.requestedReviewType.toUpperCase()}`)
  lines.push('')
  lines.push(`**Trader profile:** ${packet.userProfile.experienceLevel} experience`)

  if (packet.userProfile.assetClasses.length > 0) {
    lines.push(`**Asset classes:** ${packet.userProfile.assetClasses.join(', ')}`)
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
