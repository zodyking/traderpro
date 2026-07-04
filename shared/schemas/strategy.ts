import { z } from 'zod'
import type {
  Condition,
  ExecutionAssumptions,
  MarketFilters,
  RiskModel,
  RuleAst,
  Signal,
} from '../types/strategy'

export const opSchema = z.enum(['gt', 'gte', 'lt', 'lte', 'eq_within'])

export const indicatorRefSchema = z.object({
  indicator: z.enum(['ema', 'sma', 'rsi', 'vwap', 'atr', 'macd', 'bbands', 'volume_avg']),
  params: z.record(z.string(), z.number()),
  timeframe: z.string().optional(),
  offset: z.number().int().nonnegative().optional(),
})

export const levelRefSchema = z.union([
  indicatorRefSchema,
  z.object({
    type: z.enum(['price', 'vwap', 'session_high', 'session_low']),
  }),
])

export const sessionRefSchema = z.object({
  session: z.enum(['regular', 'extended', 'premarket', 'afterhours', '24h']),
  timezone: z.string().optional(),
})

export const conditionSchema: z.ZodType<Condition> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('indicator_compare'),
    left: indicatorRefSchema,
    op: opSchema,
    right: z.union([indicatorRefSchema, z.number()]),
  }),
  z.object({
    type: z.literal('price_level'),
    field: z.enum(['open', 'high', 'low', 'close']),
    op: opSchema,
    ref: levelRefSchema,
  }),
  z.object({
    type: z.literal('crossover'),
    a: indicatorRefSchema,
    b: indicatorRefSchema,
    direction: z.enum(['above', 'below']),
  }),
  z.object({
    type: z.literal('candle_pattern'),
    pattern: z.enum(['engulfing', 'pin_bar', 'inside_bar', 'doji']),
  }),
  z.object({
    type: z.literal('time_window'),
    session: sessionRefSchema,
  }),
])

export const signalSchema: z.ZodType<Signal> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['entry_long', 'entry_short', 'exit', 'filter', 'warning']),
  logic: z.enum(['all', 'any']),
  conditions: z.array(conditionSchema).min(1),
})

export const ruleAstSchema: z.ZodType<RuleAst> = z.object({
  signals: z.array(signalSchema).min(1),
})

export const riskModelSchema: z.ZodType<RiskModel> = z.object({
  stopLoss: z
    .object({
      type: z.enum(['fixed', 'percent', 'atr']),
      value: z.number(),
    })
    .optional(),
  takeProfit: z
    .object({
      type: z.enum(['fixed', 'percent', 'r_multiple']),
      value: z.number(),
    })
    .optional(),
  trailingStop: z
    .object({
      type: z.enum(['percent', 'atr']),
      value: z.number(),
    })
    .optional(),
  sizingMethod: z
    .enum(['fixed_shares', 'fixed_dollars', 'percent_equity', 'risk_per_trade'])
    .optional(),
  maxRiskPerTrade: z.number().optional(),
  maxDailyLoss: z.number().optional(),
})

export const marketFiltersSchema: z.ZodType<MarketFilters> = z.object({
  regime: z.array(z.string()).optional(),
  session: sessionRefSchema.optional(),
  volatility: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  spread: z
    .object({
      max: z.number().optional(),
    })
    .optional(),
  volume: z
    .object({
      min: z.number().optional(),
    })
    .optional(),
})

export const executionAssumptionsSchema: z.ZodType<ExecutionAssumptions> = z.object({
  slippage: z
    .object({
      type: z.enum(['fixed', 'percent', 'atr']),
      value: z.number(),
    })
    .optional(),
  fees: z
    .object({
      type: z.enum(['per_share', 'percent', 'fixed']),
      value: z.number(),
    })
    .optional(),
  fillModel: z.enum(['next_open', 'close_confirmation', 'intrabar']).optional(),
})

export const createStrategySchema = z.object({
  name: z.string().min(1).max(120),
  assetClass: z.enum(['stock', 'crypto', 'forex', 'futures', 'index', 'option']),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']),
})

export const updateStrategySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  archivedAt: z.coerce.date().nullable().optional(),
})

export const createStrategyVersionSchema = z.object({
  rules: ruleAstSchema,
  riskModel: riskModelSchema,
  filters: marketFiltersSchema.optional(),
  assumptions: executionAssumptionsSchema.optional(),
  note: z.string().max(2000).optional(),
})

export const validateStrategySchema = z.object({
  rules: ruleAstSchema,
  riskModel: riskModelSchema,
  filters: marketFiltersSchema.optional(),
  assumptions: executionAssumptionsSchema.optional(),
})

export type CreateStrategyInput = z.infer<typeof createStrategySchema>
export type UpdateStrategyInput = z.infer<typeof updateStrategySchema>
export type CreateStrategyVersionInput = z.infer<typeof createStrategyVersionSchema>
export type ValidateStrategyInput = z.infer<typeof validateStrategySchema>
