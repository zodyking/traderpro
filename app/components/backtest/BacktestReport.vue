<script setup lang="ts">
import type { BacktestMetrics, BacktestTrade, EquityPoint } from '~/stores/backtest'

const props = defineProps<{
  metrics: BacktestMetrics | null
  trades: BacktestTrade[]
  equity: EquityPoint[]
  loading?: boolean
}>()

function pct(value?: number | null, digits = 1) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

function num(value?: number | null, digits = 2) {
  if (value == null) return '—'
  return value.toFixed(digits)
}

function ratio(value?: number | null) {
  if (value == null) return '—'
  return value.toFixed(2)
}

function metricStatus(
  key: string,
  value?: number | null,
): 'bull' | 'bear' | 'neutral' | 'warn' {
  if (value == null) return 'neutral'
  if (key === 'maxDrawdown') return value > 0.15 ? 'bear' : 'neutral'
  if (key === 'winRate') return value >= 0.5 ? 'bull' : 'warn'
  if (['totalReturn', 'cagr', 'expectancy', 'profitFactor', 'sharpe', 'sortino'].includes(key)) {
    return value > 0 ? 'bull' : value < 0 ? 'bear' : 'neutral'
  }
  return 'neutral'
}

const metricCards = computed(() => {
  const m = props.metrics
  if (!m) return []

  return [
    { label: 'Total return', value: pct(m.totalReturn), status: metricStatus('totalReturn', m.totalReturn), explanation: 'Net return over the backtest period.' },
    { label: 'CAGR', value: pct(m.cagr), status: metricStatus('cagr', m.cagr), explanation: 'Compound annual growth rate.' },
    { label: 'Sharpe', value: ratio(m.sharpe), status: metricStatus('sharpe', m.sharpe), explanation: 'Risk-adjusted return per unit of volatility.' },
    { label: 'Sortino', value: ratio(m.sortino), status: metricStatus('sortino', m.sortino), explanation: 'Return per unit of downside deviation.' },
    { label: 'Max drawdown', value: pct(m.maxDrawdown), status: metricStatus('maxDrawdown', m.maxDrawdown), explanation: 'Largest peak-to-trough equity decline.' },
    { label: 'Win rate', value: pct(m.winRate), status: metricStatus('winRate', m.winRate), explanation: 'Percentage of winning trades.' },
    { label: 'Profit factor', value: ratio(m.profitFactor), status: metricStatus('profitFactor', m.profitFactor), explanation: 'Gross profit divided by gross loss.' },
    { label: 'Expectancy', value: num(m.expectancy), status: metricStatus('expectancy', m.expectancy), explanation: 'Average PnL per trade.' },
    { label: 'Trades', value: m.tradeCount, status: 'neutral' as const, explanation: 'Total closed trades in the run.' },
    { label: 'Avg win', value: num(m.avgWin), status: 'bull' as const, explanation: 'Mean PnL of winning trades.' },
    { label: 'Avg loss', value: num(m.avgLoss), status: 'bear' as const, explanation: 'Mean PnL of losing trades.' },
    { label: 'Exposure', value: pct(m.exposurePct), status: 'neutral' as const, explanation: 'Average capital deployed in the market.' },
    { label: 'Win streak', value: m.longestWinStreak ?? '—', status: 'bull' as const, explanation: 'Longest consecutive winning trades.' },
    { label: 'Loss streak', value: m.longestLossStreak ?? '—', status: 'bear' as const, explanation: 'Longest consecutive losing trades.' },
  ]
})

const qualityWarnings = computed(() => props.metrics?.qualityWarnings ?? [])

const monthlyReturns = computed(() => {
  const breakdown = props.metrics?.regimeBreakdown ?? {}
  return Object.entries(breakdown)
    .map(([month, stats]) => ({
      month,
      returnPct: (stats as { returnPct?: number }).returnPct ?? null,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="qualityWarnings.length"
      class="rounded-lg border border-warn/30 bg-warn/10 p-4"
    >
      <p class="mb-2 text-xs font-medium tracking-wide text-warn uppercase">
        Data quality warnings
      </p>
      <ul class="flex flex-col gap-1.5">
        <li
          v-for="(warning, index) in qualityWarnings"
          :key="index"
          class="flex items-start gap-2 text-sm text-text-secondary"
        >
          <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-warn" />
          {{ warning }}
        </li>
      </ul>
    </div>

    <div
      v-if="props.metrics && props.metrics.tradeCount < 30"
      class="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3"
    >
      <svg class="mt-0.5 size-4 shrink-0 text-accent" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm8-3.25a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V5.5A.75.75 0 018 4.75zm0 7a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
      </svg>
      <div>
        <span class="inline-flex items-center gap-1.5">
          <span class="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
            Exploratory
          </span>
          <span class="text-sm font-medium text-text-primary">Low-trade-count result</span>
        </span>
        <p class="mt-0.5 text-xs text-text-secondary">
          This backtest has only <strong>{{ props.metrics.tradeCount }}</strong> closed trade{{ props.metrics.tradeCount === 1 ? '' : 's' }}.
          Statistical metrics are unreliable below 30 trades — treat these results as exploratory only.
        </p>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <UiMetricCard
        v-for="card in metricCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :status="card.status"
        :explanation="card.explanation"
        :loading="props.loading"
      />
    </div>

    <UiPanel title="Equity curve">
      <ClientOnly>
        <BacktestEquityCurve
          :points="props.equity"
          :height="300"
        />
      </ClientOnly>
    </UiPanel>

    <UiPanel
      v-if="monthlyReturns.length"
      title="Monthly returns"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="text-text-secondary">
              <th class="pb-2 pr-4 font-medium">
                Month
              </th>
              <th class="pb-2 font-medium">
                Return
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in monthlyReturns"
              :key="row.month"
              class="border-t border-border-hair text-text-primary"
            >
              <td class="py-2 pr-4 text-text-secondary">
                {{ row.month }}
              </td>
              <td
                class="py-2 font-mono tabular-nums"
                :class="{
                  'text-bull': row.returnPct != null && row.returnPct > 0,
                  'text-bear': row.returnPct != null && row.returnPct < 0,
                }"
              >
                {{ pct(row.returnPct) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiPanel>

    <UiPanel title="Trade log">
      <BacktestTradeTable :trades="props.trades" />
    </UiPanel>
  </div>
</template>
