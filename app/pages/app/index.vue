<script setup lang="ts">
import type { PerformanceSummary } from '#shared/schemas/broker'

definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

type MetricStatus = 'bull' | 'bear' | 'neutral' | 'warn'
type DeltaDirection = 'up' | 'down' | 'flat'

type Metric = {
  label: string
  value: string
  delta?: string
  deltaDirection: DeltaDirection
  status: MetricStatus
  explanation: string
}

type ProviderState = 'healthy' | 'delayed' | 'gapped' | 'untrusted' | 'unavailable'

type UsageData = {
  plan: { id: string, label: string }
  usage: {
    backtestsPerMonth: { used: number, limit: number }
    aiCredits: { used: number, limit: number }
    scannerSymbols: { used: number, limit: number }
  }
}

type ProvidersResponse = {
  providers: Array<{ id: string, label: string, status: ProviderState, message?: string }>
  active: string
  status: ProviderState
  message?: string
}

const DEMO_METRICS: Metric[] = [
  {
    label: 'Portfolio P&L',
    value: '+$12,480',
    delta: '+2.4% today',
    deltaDirection: 'up',
    status: 'bull',
    explanation: 'Unrealized and realized P&L across all active strategies.',
  },
  {
    label: 'Sharpe (30d)',
    value: '1.84',
    delta: '+0.12 vs prior',
    deltaDirection: 'up',
    status: 'bull',
    explanation: 'Risk-adjusted return over the trailing 30-day window.',
  },
  {
    label: 'Max Drawdown',
    value: '-4.2%',
    delta: 'Within limit',
    deltaDirection: 'flat',
    status: 'neutral',
    explanation: 'Peak-to-trough decline on the equity curve.',
  },
  {
    label: 'Active Strategies',
    value: '7',
    delta: '2 paper, 5 live',
    deltaDirection: 'flat',
    status: 'neutral',
    explanation: 'Strategies currently deployed or in paper trading.',
  },
  {
    label: 'Win Rate',
    value: '58.3%',
    delta: '-1.2% vs 90d',
    deltaDirection: 'down',
    status: 'warn',
    explanation: 'Percentage of profitable trades in the current period.',
  },
  {
    label: 'Data Latency',
    value: '42ms',
    delta: 'Polygon healthy',
    deltaDirection: 'flat',
    status: 'bull',
    explanation: 'Median tick-to-screen latency across connected providers.',
  },
]

const loading = ref(true)
const performance = ref<PerformanceSummary | null>(null)
const usage = ref<UsageData | null>(null)
const providers = ref<ProvidersResponse | null>(null)
const strategyCount = ref<number | null>(null)

function fmtCurrency(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtPct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`
}

function computeMaxDrawdown(curve: PerformanceSummary['equityCurve']): number | null {
  if (!curve.length) return null
  let peak = -Infinity
  let maxDd = 0
  for (const point of curve) {
    peak = Math.max(peak, point.cumulativePnl)
    if (peak > 0) {
      maxDd = Math.max(maxDd, (peak - point.cumulativePnl) / peak)
    }
  }
  return maxDd > 0 ? maxDd : null
}

const providerStatusLabel: Record<ProviderState, string> = {
  healthy: 'Healthy',
  delayed: 'Delayed',
  gapped: 'Gapped',
  untrusted: 'Untrusted',
  unavailable: 'Unavailable',
}

const metrics = computed<Metric[]>(() => {
  const demo = DEMO_METRICS
  const perf = performance.value
  const hasBroker = perf != null && perf.totalTrades > 0

  const portfolioPnl: Metric = hasBroker
    ? {
        label: 'Portfolio P&L',
        value: fmtCurrency(perf.totalPnl),
        delta: `${perf.totalTrades} trades`,
        deltaDirection: perf.totalPnl > 0 ? 'up' : perf.totalPnl < 0 ? 'down' : 'flat',
        status: perf.totalPnl > 0 ? 'bull' : perf.totalPnl < 0 ? 'bear' : 'neutral',
        explanation: demo[0]!.explanation,
      }
    : demo[0]!

  const maxDd = hasBroker ? computeMaxDrawdown(perf.equityCurve) : null
  const maxDrawdown: Metric = maxDd != null
    ? {
        label: 'Max Drawdown',
        value: `-${fmtPct(maxDd)}`,
        delta: maxDd <= 0.05 ? 'Within limit' : 'Above target',
        deltaDirection: 'flat',
        status: maxDd <= 0.05 ? 'neutral' : 'warn',
        explanation: demo[2]!.explanation,
      }
    : demo[2]!

  const winRate: Metric = hasBroker && perf.winRate != null
    ? {
        label: 'Win Rate',
        value: fmtPct(perf.winRate),
        delta: perf.profitFactor != null ? `PF ${perf.profitFactor.toFixed(2)}` : undefined,
        deltaDirection: perf.winRate >= 0.5 ? 'up' : 'down',
        status: perf.winRate >= 0.5 ? 'bull' : 'warn',
        explanation: demo[4]!.explanation,
      }
    : demo[4]!

  const strategies: Metric = strategyCount.value != null
    ? {
        label: 'Active Strategies',
        value: String(strategyCount.value),
        delta: usage.value
          ? `${usage.value.usage.backtestsPerMonth.used}/${usage.value.usage.backtestsPerMonth.limit} backtests`
          : undefined,
        deltaDirection: 'flat',
        status: 'neutral',
        explanation: demo[3]!.explanation,
      }
    : usage.value
      ? {
          label: 'Active Strategies',
          value: String(usage.value.usage.scannerSymbols.used),
          delta: `${usage.value.plan.label} plan`,
          deltaDirection: 'flat',
          status: 'neutral',
          explanation: demo[3]!.explanation,
        }
      : demo[3]!

  const primaryProvider = providers.value?.providers[0]
  const dataLatency: Metric = primaryProvider
    ? {
        label: 'Data Latency',
        value: providerStatusLabel[primaryProvider.status],
        delta: primaryProvider.label,
        deltaDirection: primaryProvider.status === 'healthy' ? 'flat' : 'down',
        status: primaryProvider.status === 'healthy'
          ? 'bull'
          : primaryProvider.status === 'delayed' || primaryProvider.status === 'gapped'
            ? 'warn'
            : 'neutral',
        explanation: demo[5]!.explanation,
      }
    : demo[5]!

  return [
    portfolioPnl,
    demo[1]!,
    maxDrawdown,
    strategies,
    winRate,
    dataLatency,
  ]
})

const providerBadges = computed(() => {
  if (providers.value?.providers.length) {
    return providers.value.providers.map(p => ({
      name: p.label,
      state: p.status,
      title: p.message,
    }))
  }
  return [
    { name: 'Polygon', state: 'healthy' as const, title: undefined },
    { name: 'Alpaca', state: 'delayed' as const, title: undefined },
    { name: 'Binance', state: 'healthy' as const, title: undefined },
  ]
})

onMounted(async () => {
  await Promise.all([
    $fetch<PerformanceSummary>('/api/broker/performance')
      .then((data) => {
        if (data.totalTrades > 0) performance.value = data
      })
      .catch(() => {}),
    $fetch<UsageData>('/api/me/usage')
      .then(data => { usage.value = data })
      .catch(() => {}),
    $fetch<ProvidersResponse>('/api/providers/status')
      .then(data => { providers.value = data })
      .catch(() => {}),
    $fetch<{ strategies: unknown[] }>('/api/strategies')
      .then(data => { strategyCount.value = data.strategies.length })
      .catch(() => {}),
  ])
  loading.value = false
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <header>
      <h1 class="text-lg font-semibold text-text-primary">
        Command Center
      </h1>
      <p class="mt-1 text-sm text-text-secondary">
        Portfolio overview and system health at a glance.
      </p>
    </header>

    <div class="flex flex-wrap items-center gap-2">
      <WorkspaceProviderBadge
        v-for="badge in providerBadges"
        :key="badge.name"
        :name="badge.name"
        :state="badge.state"
        :title="badge.title"
      />
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UiMetricCard
        v-for="metric in metrics"
        :key="metric.label"
        v-bind="metric"
        :loading="loading"
      />
    </div>

    <UiPanel title="Recent Activity">
      <AlertsAlertFeed />
    </UiPanel>
  </div>
</template>
