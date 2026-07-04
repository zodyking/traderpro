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
