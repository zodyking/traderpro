import type {
  Condition,
  IndicatorRef,
  LevelRef,
  Op,
  Signal,
} from '#shared/types/strategy'

export type ConditionValidity = 'valid' | 'warning' | 'error'

const OP_LABELS: Record<Op, string> = {
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  eq_within: '≈',
}

const FIELD_LABELS: Record<'open' | 'high' | 'low' | 'close', string> = {
  open: 'Open',
  high: 'High',
  low: 'Low',
  close: 'Close',
}

const PATTERN_LABELS: Record<'engulfing' | 'pin_bar' | 'inside_bar' | 'doji', string> = {
  engulfing: 'Engulfing',
  pin_bar: 'Pin bar',
  inside_bar: 'Inside bar',
  doji: 'Doji',
}

function primaryParam(params: Record<string, number>): number | undefined {
  return params.period ?? params.length ?? Object.values(params)[0]
}

export function formatIndicatorRef(ref: IndicatorRef): string {
  const period = primaryParam(ref.params)
  const label = ref.indicator.toUpperCase()
  return period !== undefined ? `${label}(${period})` : label
}

function formatLevelRef(ref: LevelRef): string {
  if ('indicator' in ref) {
    return formatIndicatorRef(ref)
  }

  const labels: Record<typeof ref.type, string> = {
    price: 'Price',
    vwap: 'VWAP',
    session_high: 'Session high',
    session_low: 'Session low',
  }
  return labels[ref.type]
}

function formatCompareSide(side: IndicatorRef | number): string {
  return typeof side === 'number' ? String(side) : formatIndicatorRef(side)
}

export function formatCondition(condition: Condition): string {
  switch (condition.type) {
    case 'indicator_compare': {
      if (typeof condition.right === 'number' && (condition.op === 'lt' || condition.op === 'gt')) {
        const direction = condition.op === 'lt' ? 'below' : 'above'
        return `${formatIndicatorRef(condition.left)} crosses ${direction} ${condition.right}`
      }
      return `${formatIndicatorRef(condition.left)} ${OP_LABELS[condition.op]} ${formatCompareSide(condition.right)}`
    }
    case 'price_level':
      return `${FIELD_LABELS[condition.field]} ${OP_LABELS[condition.op]} ${formatLevelRef(condition.ref)}`
    case 'crossover':
      return `${formatIndicatorRef(condition.a)} crosses ${condition.direction} ${formatIndicatorRef(condition.b)}`
    case 'candle_pattern':
      return PATTERN_LABELS[condition.pattern] ?? condition.pattern
    case 'time_window':
      return `During ${condition.session.session} session`
    default:
      return 'Unknown condition'
  }
}

export function validateCondition(condition: Condition): ConditionValidity {
  switch (condition.type) {
    case 'indicator_compare': {
      if (!condition.left.indicator) return 'error'
      const period = primaryParam(condition.left.params)
      if (period === undefined || period <= 0) return 'error'
      if (typeof condition.right === 'number' && condition.left.indicator === 'rsi') {
        if (condition.right < 0 || condition.right > 100) return 'warning'
      }
      if (typeof condition.right === 'object' && !condition.right.indicator) return 'error'
      return 'valid'
    }
    case 'price_level': {
      if (!condition.field || !condition.op) return 'error'
      if ('indicator' in condition.ref) {
        const period = primaryParam(condition.ref.params)
        if (period === undefined || period <= 0) return 'error'
      }
      return 'valid'
    }
    case 'crossover': {
      if (!condition.a.indicator || !condition.b.indicator) return 'error'
      if (condition.a.indicator === condition.b.indicator) return 'warning'
      return 'valid'
    }
    case 'candle_pattern':
      return condition.pattern ? 'valid' : 'error'
    case 'time_window':
      return condition.session?.session ? 'valid' : 'error'
    default:
      return 'error'
  }
}

export function validateSignal(signal: Signal): ConditionValidity {
  if (!signal.name.trim()) return 'error'
  if (!signal.conditions.length) return 'warning'

  const states = signal.conditions.map(validateCondition)
  if (states.includes('error')) return 'error'
  if (states.includes('warning')) return 'warning'
  return 'valid'
}

export const validityBorderClasses: Record<ConditionValidity, string> = {
  valid: 'border-border-strong',
  warning: 'border-warn/50',
  error: 'border-bear/60',
}
