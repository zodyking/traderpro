<script setup lang="ts">
definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

const metrics = [
  {
    label: 'Portfolio P&L',
    value: '+$12,480',
    delta: '+2.4% today',
    deltaDirection: 'up' as const,
    status: 'bull' as const,
    explanation: 'Unrealized and realized P&L across all active strategies.',
  },
  {
    label: 'Sharpe (30d)',
    value: '1.84',
    delta: '+0.12 vs prior',
    deltaDirection: 'up' as const,
    status: 'bull' as const,
    explanation: 'Risk-adjusted return over the trailing 30-day window.',
  },
  {
    label: 'Max Drawdown',
    value: '-4.2%',
    delta: 'Within limit',
    deltaDirection: 'flat' as const,
    status: 'neutral' as const,
    explanation: 'Peak-to-trough decline on the equity curve.',
  },
  {
    label: 'Active Strategies',
    value: '7',
    delta: '2 paper, 5 live',
    deltaDirection: 'flat' as const,
    status: 'neutral' as const,
    explanation: 'Strategies currently deployed or in paper trading.',
  },
  {
    label: 'Win Rate',
    value: '58.3%',
    delta: '-1.2% vs 90d',
    deltaDirection: 'down' as const,
    status: 'warn' as const,
    explanation: 'Percentage of profitable trades in the current period.',
  },
  {
    label: 'Data Latency',
    value: '42ms',
    delta: 'Polygon healthy',
    deltaDirection: 'flat' as const,
    status: 'bull' as const,
    explanation: 'Median tick-to-screen latency across connected providers.',
  },
]
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
      <WorkspaceProviderBadge name="Polygon" state="healthy" />
      <WorkspaceProviderBadge name="Alpaca" state="delayed" />
      <WorkspaceProviderBadge name="Binance" state="healthy" />
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UiMetricCard
        v-for="metric in metrics"
        :key="metric.label"
        v-bind="metric"
      />
    </div>

    <UiPanel title="Recent Activity">
      <p class="text-sm text-text-muted">
        Activity feed and alerts will appear here.
      </p>
    </UiPanel>
  </div>
</template>
