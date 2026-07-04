import type { RiskModel, RuleAst } from '../types/strategy'
import {
  BREAKOUT_RETEST_NAME,
  createBreakoutRetestRiskModel,
  createBreakoutRetestRules,
} from './breakout-retest'
import {
  MEAN_REVERSION_NAME,
  createMeanReversionRiskModel,
  createMeanReversionRules,
} from './mean-reversion'
import {
  MOMENTUM_CONTINUATION_NAME,
  createMomentumContinuationRiskModel,
  createMomentumContinuationRules,
} from './momentum-continuation'
import {
  OPENING_RANGE_BREAKOUT_NAME,
  createOpeningRangeBreakoutRiskModel,
  createOpeningRangeBreakoutRules,
} from './opening-range-breakout'
import {
  TREND_PULLBACK_NAME,
  createTrendPullbackRiskModel,
  createTrendPullbackRules,
} from './trend-pullback'
import {
  VWAP_RECLAIM_NAME,
  createVwapReclaimRiskModel,
  createVwapReclaimRules,
} from './vwap-reclaim'

export {
  BREAKOUT_RETEST_NAME,
  createBreakoutRetestRiskModel,
  createBreakoutRetestRules,
} from './breakout-retest'
export {
  MEAN_REVERSION_NAME,
  createMeanReversionRiskModel,
  createMeanReversionRules,
} from './mean-reversion'
export {
  MOMENTUM_CONTINUATION_NAME,
  createMomentumContinuationRiskModel,
  createMomentumContinuationRules,
} from './momentum-continuation'
export {
  OPENING_RANGE_BREAKOUT_NAME,
  createOpeningRangeBreakoutRiskModel,
  createOpeningRangeBreakoutRules,
} from './opening-range-breakout'
export {
  TREND_PULLBACK_NAME,
  createTrendPullbackRiskModel,
  createTrendPullbackRules,
} from './trend-pullback'
export {
  VWAP_RECLAIM_NAME,
  createVwapReclaimRiskModel,
  createVwapReclaimRules,
} from './vwap-reclaim'

export type StrategyTemplateId =
  | 'trend-pullback'
  | 'breakout-retest'
  | 'mean-reversion'
  | 'vwap-reclaim'
  | 'opening-range-breakout'
  | 'momentum-continuation'

export type StrategyTemplate = {
  id: StrategyTemplateId
  name: string
  description: string
  assetClass: 'stock' | 'crypto' | 'forex' | 'futures'
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  createRules: () => RuleAst
  createRiskModel: () => RiskModel
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: 'trend-pullback',
    name: TREND_PULLBACK_NAME,
    description: 'Enter on RSI pullbacks in an EMA-50 uptrend. Classic momentum + mean reversion hybrid.',
    assetClass: 'stock',
    timeframe: '1h',
    difficulty: 'beginner',
    createRules: createTrendPullbackRules,
    createRiskModel: createTrendPullbackRiskModel,
  },
  {
    id: 'breakout-retest',
    name: BREAKOUT_RETEST_NAME,
    description: 'Buy breakouts above the 20-period SMA with RSI momentum confirmation.',
    assetClass: 'stock',
    timeframe: '1h',
    difficulty: 'beginner',
    createRules: createBreakoutRetestRules,
    createRiskModel: createBreakoutRetestRiskModel,
  },
  {
    id: 'mean-reversion',
    name: MEAN_REVERSION_NAME,
    description: 'Fade extreme oversold readings below RSI 25 with SMA-50 trend context.',
    assetClass: 'stock',
    timeframe: '4h',
    difficulty: 'intermediate',
    createRules: createMeanReversionRules,
    createRiskModel: createMeanReversionRiskModel,
  },
  {
    id: 'vwap-reclaim',
    name: VWAP_RECLAIM_NAME,
    description: 'Enter intraday when price reclaims VWAP after a failed breakdown.',
    assetClass: 'stock',
    timeframe: '15m',
    difficulty: 'intermediate',
    createRules: createVwapReclaimRules,
    createRiskModel: createVwapReclaimRiskModel,
  },
  {
    id: 'opening-range-breakout',
    name: OPENING_RANGE_BREAKOUT_NAME,
    description: 'Capture directional moves when price breaks above session high with volume surge.',
    assetClass: 'stock',
    timeframe: '5m',
    difficulty: 'intermediate',
    createRules: createOpeningRangeBreakoutRules,
    createRiskModel: createOpeningRangeBreakoutRiskModel,
  },
  {
    id: 'momentum-continuation',
    name: MOMENTUM_CONTINUATION_NAME,
    description: 'Ride EMA-8/21 crossovers in a long-term EMA-200 uptrend with trailing stop.',
    assetClass: 'stock',
    timeframe: '1d',
    difficulty: 'advanced',
    createRules: createMomentumContinuationRules,
    createRiskModel: createMomentumContinuationRiskModel,
  },
]

export function getTemplateById(id: StrategyTemplateId): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find((t) => t.id === id)
}
