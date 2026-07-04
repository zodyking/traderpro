import type { IndicatorRef, RiskModel, RuleAst } from '../../../shared/types/strategy'

export type ValidationIssue = {
  code: string
  message: string
  path?: string
}

export type ValidationResult = {
  warnings: ValidationIssue[]
  errors: ValidationIssue[]
}

export type ValidationContext = {
  strategyTimeframe?: string
}

const TIMEFRAME_MINUTES: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
  '1w': 10080,
}

function indicatorPeriod(ref: IndicatorRef): number {
  return ref.params.period ?? ref.params.length ?? 14
}

function collectIndicatorRefs(rules: RuleAst): IndicatorRef[] {
  const refs: IndicatorRef[] = []
  for (const signal of rules.signals) {
    for (const condition of signal.conditions) {
      switch (condition.type) {
        case 'indicator_compare':
          refs.push(condition.left)
          if (typeof condition.right !== 'number') {
            refs.push(condition.right)
          }
          break
        case 'price_level':
          if ('indicator' in condition.ref) {
            refs.push(condition.ref)
          }
          break
        case 'crossover':
          refs.push(condition.a, condition.b)
          break
        default:
          break
      }
    }
  }
  return refs
}

function hasExitSignal(rules: RuleAst): boolean {
  return rules.signals.some(signal => signal.kind === 'exit')
}

function estimateHoldingBars(rules: RuleAst): number {
  const refs = collectIndicatorRefs(rules)
  if (!refs.length) {
    return 1
  }
  return Math.max(...refs.map(indicatorPeriod))
}

export function validateStrategyVersion(
  rules: RuleAst,
  riskModel: RiskModel,
  userUiMode: 'novice' | 'pro',
  context: ValidationContext = {},
): ValidationResult {
  const warnings: ValidationIssue[] = []
  const errors: ValidationIssue[] = []

  if (!riskModel.stopLoss) {
    const issue: ValidationIssue = {
      code: 'missing_stop_loss',
      message: 'Stop loss is not defined.',
      path: 'riskModel.stopLoss',
    }
    if (userUiMode === 'novice') {
      errors.push(issue)
    }
    else {
      warnings.push(issue)
    }
  }

  if (!riskModel.sizingMethod) {
    warnings.push({
      code: 'missing_position_size',
      message: 'Position sizing method is not defined.',
      path: 'riskModel.sizingMethod',
    })
  }

  const strategyTimeframe = context.strategyTimeframe
  if (strategyTimeframe) {
    const strategyMinutes = TIMEFRAME_MINUTES[strategyTimeframe] ?? 0
    const holdingBars = estimateHoldingBars(rules)
    const impliedHoldMinutes = holdingBars * strategyMinutes

    const mismatchedTimeframes = collectIndicatorRefs(rules)
      .map(ref => ref.timeframe)
      .filter((timeframe): timeframe is string => Boolean(timeframe && timeframe !== strategyTimeframe))

    if (mismatchedTimeframes.length > 0) {
      warnings.push({
        code: 'timeframe_mismatch',
        message: 'One or more indicators use a different timeframe than the strategy.',
        path: 'rules',
      })
    }

    const isIntradayStrategy = strategyMinutes < TIMEFRAME_MINUTES['1d']!
    const impliesMultiDayHold = impliedHoldMinutes >= TIMEFRAME_MINUTES['1d']!
    if (isIntradayStrategy && impliesMultiDayHold && !hasExitSignal(rules)) {
      warnings.push({
        code: 'timeframe_holding_mismatch',
        message: 'Indicator lookback implies a longer holding period than this intraday timeframe suggests.',
        path: 'rules',
      })
    }
  }

  return { warnings, errors }
}
