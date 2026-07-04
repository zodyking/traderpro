<script setup lang="ts">
import type { PerformanceSummary } from '~/stores/broker'

const props = defineProps<{
  summary: PerformanceSummary | null
  loading?: boolean
  executions: Array<{
    id: string
    rawSymbol: string
    side: 'buy' | 'sell'
    qty: number
    price: number
    fees: string
    executedAt: string
    orderRef?: string | null
  }>
  executionsLoading?: boolean
}>()

function fmt(n: number | null | undefined, decimals = 2, prefix = ''): string {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : n > 0 ? '+' : ''
  return `${sign}${prefix}${abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
}

const pnlStatus = computed((): 'bull' | 'bear' | 'neutral' => {
  if (!props.summary) return 'neutral'
  return props.summary.totalPnl > 0 ? 'bull' : props.summary.totalPnl < 0 ? 'bear' : 'neutral'
})

const metrics = computed(() => {
  const s = props.summary
  return [
    {
      label: 'Total Trades',
      value: s?.totalTrades ?? '—',
      status: 'neutral' as const,
    },
    {
      label: 'Win Rate',
      value: fmtPct(s?.winRate),
      status: s?.winRate != null && s.winRate >= 0.5 ? ('bull' as const) : ('warn' as const),
    },
    {
      label: 'Total P&L',
      value: fmt(s?.totalPnl, 2, '$'),
      status: pnlStatus.value,
    },
    {
      label: 'Total Fees',
      value: fmt(s?.totalFees, 2, '$'),
      status: 'neutral' as const,
    },
    {
      label: 'Avg Win',
      value: fmt(s?.avgWin, 2, '$'),
      status: 'bull' as const,
    },
    {
      label: 'Avg Loss',
      value: fmt(s?.avgLoss, 2, '$'),
      status: 'bear' as const,
    },
    {
      label: 'Profit Factor',
      value: s?.profitFactor != null ? s.profitFactor.toFixed(2) : '—',
      status: s?.profitFactor != null && s.profitFactor >= 1 ? ('bull' as const) : ('warn' as const),
    },
    {
      label: 'Best Trade',
      value: fmt(s?.bestTrade, 2, '$'),
      status: 'bull' as const,
    },
  ]
})

// Equity curve points formatted for the chart
const equityPoints = computed(() => {
  if (!props.summary?.equityCurve.length) return []
  return props.summary.equityCurve.map((p) => ({
    time: `${p.date}T00:00:00Z`,
    equity: p.cumulativePnl,
    drawdown: 0,
  }))
})

function sideClass(side: string) {
  return side === 'buy' ? 'text-bull' : 'text-bear'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Metric Cards -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <template v-if="loading">
        <div
          v-for="i in 8"
          :key="i"
          class="rounded-lg border border-border-hair bg-bg-surface p-4"
        >
          <UiSkeleton class="mb-2 h-3 w-20" />
          <UiSkeleton class="h-7 w-24" />
        </div>
      </template>
      <template v-else>
        <UiMetricCard
          v-for="m in metrics"
          :key="m.label"
          :label="m.label"
          :value="m.value"
          :status="m.status"
        />
      </template>
    </div>

    <!-- Equity Curve -->
    <UiPanel title="Cumulative P&L Curve">
      <template v-if="loading">
        <UiSkeleton class="h-[200px] w-full" />
      </template>
      <BacktestEquityCurve
        v-else
        :points="equityPoints"
        :height="200"
        :show-drawdown="false"
      />
    </UiPanel>

    <!-- Top Symbols -->
    <UiPanel
      v-if="summary?.tradesBySymbol.length"
      title="P&L by Symbol"
    >
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border-hair text-left text-xs text-text-muted">
            <th class="pb-2 font-medium">
              Symbol
            </th>
            <th class="pb-2 font-medium text-right">
              Trades
            </th>
            <th class="pb-2 font-medium text-right">
              P&L
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in summary.tradesBySymbol"
            :key="row.symbol"
            class="border-b border-border-hair/50 last:border-0"
          >
            <td class="py-2 font-mono text-text-primary">
              {{ row.symbol }}
            </td>
            <td class="py-2 text-right font-mono text-text-secondary">
              {{ row.trades }}
            </td>
            <td
              class="py-2 text-right font-mono"
              :class="row.pnl >= 0 ? 'text-bull' : 'text-bear'"
            >
              {{ fmt(row.pnl, 2, '$') }}
            </td>
          </tr>
        </tbody>
      </table>
    </UiPanel>

    <!-- Recent Executions -->
    <UiPanel title="Recent Executions">
      <template v-if="executionsLoading">
        <div class="flex flex-col gap-2">
          <UiSkeleton
            v-for="i in 5"
            :key="i"
            class="h-10 w-full"
          />
        </div>
      </template>
      <template v-else-if="!executions.length">
        <p class="py-6 text-center text-sm text-text-muted">
          No executions found.
        </p>
      </template>
      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[520px] text-sm">
            <thead>
              <tr class="border-b border-border-hair text-left text-xs text-text-muted">
                <th class="pb-2 font-medium">
                  Date
                </th>
                <th class="pb-2 font-medium">
                  Symbol
                </th>
                <th class="pb-2 font-medium">
                  Side
                </th>
                <th class="pb-2 font-medium text-right">
                  Qty
                </th>
                <th class="pb-2 font-medium text-right">
                  Price
                </th>
                <th class="pb-2 font-medium text-right">
                  Fees
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="ex in executions.slice(0, 50)"
                :key="ex.id"
                class="border-b border-border-hair/50 last:border-0"
              >
                <td class="py-1.5 font-mono text-xs text-text-muted">
                  {{ formatDate(ex.executedAt) }}
                </td>
                <td class="py-1.5 font-mono font-medium text-text-primary">
                  {{ ex.rawSymbol }}
                </td>
                <td
                  class="py-1.5 font-mono text-xs font-semibold uppercase"
                  :class="sideClass(ex.side)"
                >
                  {{ ex.side }}
                </td>
                <td class="py-1.5 text-right font-mono text-text-secondary">
                  {{ ex.qty.toLocaleString() }}
                </td>
                <td class="py-1.5 text-right font-mono text-text-secondary">
                  ${{ ex.price.toFixed(2) }}
                </td>
                <td class="py-1.5 text-right font-mono text-xs text-text-muted">
                  ${{ Number(ex.fees).toFixed(2) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </UiPanel>
  </div>
</template>
