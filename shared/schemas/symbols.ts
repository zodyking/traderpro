import { z } from 'zod'

export const symbolSearchSchema = z.object({
  q: z.string().min(1),
  assetClass: z
    .enum(['stock', 'crypto', 'forex', 'futures', 'index', 'option'])
    .optional(),
})

export const candleQuerySchema = z.object({
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']).default('1h'),
  from: z.string().optional(),
  to: z.string().optional(),
})
