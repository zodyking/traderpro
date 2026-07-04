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

    <UiPanel title="Trade log">
      <BacktestTradeTable :trades="props.trades" />
    </UiPanel>
  </div>
</template>
