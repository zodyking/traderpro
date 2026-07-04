import { z } from 'zod'

export const BROKER_TYPES = ['interactive_brokers', 'td_ameritrade', 'robinhood', 'generic'] as const
export type BrokerType = (typeof BROKER_TYPES)[number]

export const brokerImportSchema = z.object({
  broker: z.enum(BROKER_TYPES),
  label: z.string().min(1).max(80),
  csv: z.string().min(1),
})

export const brokerExecutionsQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().optional(),
})

export type BrokerImportInput = z.infer<typeof brokerImportSchema>
export type BrokerExecutionsQuery = z.infer<typeof brokerExecutionsQuerySchema>

export type BrokerConnectionRow = {
  id: string
  broker: string
  label: string
  status: string
  lastSyncAt: string | null
  createdAt: string
  accountCount: number
}

export type BrokerAccountRow = {
  id: string
  connectionId: string
  accountRef: string
  currency: string
  equity: string | null
}

export type ExecutionRow = {
  id: string
  accountId: string
  symbolId: string | null
  rawSymbol: string
  side: 'buy' | 'sell'
  qty: number
  price: number
  fees: string
  executedAt: string
  orderRef: string | null
}

export type PerformanceSummary = {
  totalTrades: number
  winRate: number | null
  totalPnl: number
  totalFees: number
  avgWin: number | null
  avgLoss: number | null
  bestTrade: number | null
  worstTrade: number | null
  profitFactor: number | null
  tradesBySymbol: Array<{ symbol: string, trades: number, pnl: number }>
  equityCurve: Array<{ date: string, cumulativePnl: number }>
}

export type CalendarPnlDay = {
  date: string
  pnl: number
  trades: number
}

export type CalendarPnlMonth = {
  year: number
  month: number
  totalPnl: number
  days: CalendarPnlDay[]
}

export type CalendarPnlData = {
  months: CalendarPnlMonth[]
}

export type AttributionRow = {
  label: string
  trades: number
  pnl: number
  winRate: number | null
}

export type AttributionData = {
  bySymbol: AttributionRow[]
  bySetupTag: AttributionRow[]
  byWeekday: AttributionRow[]
  bySession: AttributionRow[]
}
