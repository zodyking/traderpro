import { z } from 'zod'

export const realismConfigSchema = z.object({
  slippagePct: z.number().optional(),
  feePct: z.number().optional(),
  fillModel: z.enum(['next_open', 'close_confirmation']).optional(),
})

export type RealismConfig = z.infer<typeof realismConfigSchema>

export const backtestDateRangeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
})

export const backtestCreateSchema = z.object({
  strategyVersionId: z.string().uuid(),
  symbolId: z.string().uuid().optional(),
  symbolIds: z.array(z.string().uuid()).min(1).optional(),
  dateRange: backtestDateRangeSchema.optional(),
  capital: z.number().positive().default(10_000),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']).default('1d'),
  realism: realismConfigSchema.optional(),
}).superRefine((value, ctx) => {
  if (!value.symbolId && (!value.symbolIds || value.symbolIds.length === 0)) {
    ctx.addIssue({
      code: 'custom',
      message: 'symbolId or symbolIds is required',
      path: ['symbolId'],
    })
  }
})

export const backtestRunIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const backtestTradesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

export type BacktestCreateInput = z.infer<typeof backtestCreateSchema>

const candleIntervalSchema = z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w'])

export const walkForwardSchema = z.object({
  strategyVersionId: z.string().uuid().optional(),
  symbolIds: z.array(z.string().uuid()).min(1).optional(),
  dateRange: backtestDateRangeSchema.optional(),
  capital: z.number().positive().default(10_000),
  interval: candleIntervalSchema.default('1d'),
  foldCount: z.number().int().min(2).max(12).default(4),
  realism: realismConfigSchema.optional(),
  baseRunId: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (value.baseRunId) return
  if (!value.strategyVersionId) {
    ctx.addIssue({
      code: 'custom',
      message: 'strategyVersionId is required without baseRunId',
      path: ['strategyVersionId'],
    })
  }
  if (!value.symbolIds || value.symbolIds.length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'symbolIds is required without baseRunId',
      path: ['symbolIds'],
    })
  }
  if (!value.dateRange) {
    ctx.addIssue({
      code: 'custom',
      message: 'dateRange is required without baseRunId',
      path: ['dateRange'],
    })
  }
})

export const monteCarloSchema = z.object({
  iterations: z.number().int().min(100).max(10_000).default(1000),
})

export const parameterSweepSchema = z.object({
  strategyVersionId: z.string().uuid(),
  symbolIds: z.array(z.string().uuid()).min(1),
  dateRange: backtestDateRangeSchema,
  capital: z.number().positive().default(10_000),
  interval: candleIntervalSchema.default('1d'),
  stopLossValues: z.array(z.number().positive()).min(1).max(20).default([1, 2, 3, 5, 7, 10]),
  realism: realismConfigSchema.optional(),
})

export type WalkForwardInput = z.infer<typeof walkForwardSchema>
export type MonteCarloInput = z.infer<typeof monteCarloSchema>
export type ParameterSweepInput = z.infer<typeof parameterSweepSchema>
