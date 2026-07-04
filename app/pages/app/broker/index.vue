<script setup lang="ts">
import type { AttributionRow } from '#shared/schemas/broker'

definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

const store = useBrokerStore()

type Tab = 'equity' | 'calendar' | 'attribution'
const activeTab = ref<Tab>('equity')

onMounted(async () => {
  await Promise.all([
    store.fetchPerformance(store.selectedAccountId ?? undefined),
    store.fetchExecutions(store.selectedAccountId ? { accountId: store.selectedAccountId } : {}),
    store.fetchCalendar(store.selectedAccountId ?? undefined),
    store.fetchAttribution(store.selectedAccountId ?? undefined),
  ])
})

const equityPoints = computed(() => {
  if (!store.performance?.equityCurve.length) return []
  return store.performance.equityCurve.map(p => ({
    time: `${p.date}T00:00:00Z`,
    equity: p.cumulativePnl,
    drawdown: 0,
  }))
})

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
  const s = store.performance
  if (!s) return 'neutral'
  return s.totalPnl > 0 ? 'bull' : s.totalPnl < 0 ? 'bear' : 'neutral'
})

const metrics = computed(() => {
  const s = store.performance
  return [
    { label: 'Total Trades', value: s?.totalTrades ?? '—', status: 'neutral' as const },
    { label: 'Win Rate', value: fmtPct(s?.winRate), status: s?.winRate != null && s.winRate >= 0.5 ? ('bull' as const) : ('warn' as const) },
    { label: 'Total P&L', value: fmt(s?.totalPnl, 2, '$'), status: pnlStatus.value },
    { label: 'Total Fees', value: fmt(s?.totalFees, 2, '$'), status: 'neutral' as const },
    { label: 'Avg Win', value: fmt(s?.avgWin, 2, '$'), status: 'bull' as const },
    { label: 'Avg Loss', value: fmt(s?.avgLoss, 2, '$'), status: 'bear' as const },
    { label: 'Profit Factor', value: s?.profitFactor != null ? s.profitFactor.toFixed(2) : '—', status: s?.profitFactor != null && s.profitFactor >= 1 ? ('bull' as const) : ('warn' as const) },
    { label: 'Best Trade', value: fmt(s?.bestTrade, 2, '$'), status: 'bull' as const },
  ]
})

const TABS: { id: Tab, label: string }[] = [
  { id: 'equity', label: 'Equity' },
  { id: 'calendar', label: 'Calendar P&L' },
  { id: 'attribution', label: 'Attribution' },
]

function fmtPnl(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : '+'
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pnlClass(n: number) {
  return n >= 0 ? 'text-bull' : 'text-bear'
}

function attributionRows(rows: AttributionRow[] | undefined) {
  return rows ?? []
}
</script>

<template>
  <div class="flex h-[calc(100dvh-var(--spacing-command-bar))] flex-col">
    <!-- Page header -->
    <header class="shrink-0 border-b border-border-hair px-4 py-3">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold text-text-primary">
            Broker Performance
          </h1>
          <p class="mt-0.5 text-sm text-text-secondary">
            Equity curve, calendar P&amp;L heatmap, and trade attribution.
          </p>
        </div>
        <NuxtLink to="/app/settings">
          <UiBtn variant="secondary" size="sm">
            <svg class="mr-1.5 size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 8h10M3 4h10M3 12h6" stroke-linecap="round" />
            </svg>
            Import Data
          </UiBtn>
        </NuxtLink>
      </div>

      <!-- Tabs -->
      <nav
        class="mt-3 flex gap-1 border-b border-border-hair"
        aria-label="Performance tabs"
      >
        <button
          v-for="tab in TABS"
          :key="tab.id"
          type="button"
          class="-mb-px px-4 py-2 text-sm font-medium transition-colors border-b-2"
          :class="activeTab === tab.id
            ? 'border-accent text-accent'
            : 'border-transparent text-text-muted hover:text-text-secondary'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>
    </header>

    <div class="flex-1 overflow-y-auto p-4">
      <!-- ─── Equity Tab ─── -->
      <div v-if="activeTab === 'equity'" class="mx-auto max-w-5xl flex flex-col gap-6">
        <!-- Metric Cards -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <template v-if="store.performanceLoading">
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
          <template v-if="store.performanceLoading">
            <UiSkeleton class="h-[220px] w-full" />
          </template>
          <BacktestEquityCurve
            v-else
            :points="equityPoints"
            :height="220"
            :show-drawdown="false"
          />
        </UiPanel>

        <!-- Top Symbols (equity tab) -->
        <UiPanel
          v-if="store.performance?.tradesBySymbol.length"
          title="P&L by Symbol (Top 10)"
        >
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border-hair text-left text-xs text-text-muted">
                <th class="pb-2 font-medium">Symbol</th>
                <th class="pb-2 text-right font-medium">Trades</th>
                <th class="pb-2 text-right font-medium">P&L</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in store.performance!.tradesBySymbol"
                :key="row.symbol"
                class="border-b border-border-hair/50 last:border-0"
              >
                <td class="py-2 font-mono text-text-primary">{{ row.symbol }}</td>
                <td class="py-2 text-right font-mono text-text-secondary">{{ row.trades }}</td>
                <td class="py-2 text-right font-mono" :class="pnlClass(row.pnl)">{{ fmtPnl(row.pnl) }}</td>
              </tr>
            </tbody>
          </table>
        </UiPanel>

        <!-- Empty state -->
        <div
          v-if="!store.performanceLoading && !store.performance?.totalTrades"
          class="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-lg border border-border-hair bg-bg-surface text-center"
        >
          <p class="text-sm font-medium text-text-primary">No trade data yet</p>
          <p class="max-w-sm text-sm text-text-secondary">
            Import broker execution data to see your equity curve and performance metrics.
          </p>
          <NuxtLink to="/app/settings">
            <UiBtn>Import broker data</UiBtn>
          </NuxtLink>
        </div>
      </div>

      <!-- ─── Calendar P&L Tab ─── -->
      <div v-else-if="activeTab === 'calendar'" class="mx-auto max-w-4xl">
        <BrokerCalendarPnl
          :data="store.calendar"
          :loading="store.calendarLoading"
        />
        <div
          v-if="store.calendarError"
          class="mt-4 rounded-lg border border-bear/30 bg-bear/10 px-4 py-3 text-sm text-bear"
        >
          {{ store.calendarError }}
        </div>
      </div>

      <!-- ─── Attribution Tab ─── -->
      <div v-else-if="activeTab === 'attribution'" class="mx-auto max-w-5xl flex flex-col gap-6">
        <template v-if="store.attributionLoading">
          <div class="grid gap-4 lg:grid-cols-2">
            <UiSkeleton
              v-for="i in 4"
              :key="i"
              class="h-[200px] w-full"
            />
          </div>
        </template>

        <template v-else-if="store.attributionError">
          <div class="rounded-lg border border-bear/30 bg-bear/10 px-4 py-3 text-sm text-bear">
            {{ store.attributionError }}
          </div>
        </template>

        <template v-else>
          <div class="grid gap-4 lg:grid-cols-2">
            <!-- By Symbol -->
            <UiPanel title="By Symbol">
              <template v-if="!attributionRows(store.attribution?.bySymbol).length">
                <p class="py-6 text-center text-sm text-text-muted">No data</p>
              </template>
              <table v-else class="w-full text-sm">
                <thead>
                  <tr class="border-b border-border-hair text-left text-xs text-text-muted">
                    <th class="pb-2 font-medium">Symbol</th>
                    <th class="pb-2 text-right font-medium">Trades</th>
                    <th class="pb-2 text-right font-medium">Win%</th>
                    <th class="pb-2 text-right font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in attributionRows(store.attribution?.bySymbol)"
                    :key="row.label"
                    class="border-b border-border-hair/50 last:border-0"
                  >
                    <td class="py-1.5 font-mono font-medium text-text-primary">{{ row.label }}</td>
                    <td class="py-1.5 text-right font-mono text-text-secondary">{{ row.trades }}</td>
                    <td class="py-1.5 text-right font-mono text-text-muted">
                      {{ row.winRate != null ? `${(row.winRate * 100).toFixed(0)}%` : '—' }}
                    </td>
                    <td class="py-1.5 text-right font-mono" :class="pnlClass(row.pnl)">{{ fmtPnl(row.pnl) }}</td>
                  </tr>
                </tbody>
              </table>
            </UiPanel>

            <!-- By Setup Tag -->
            <UiPanel title="By Setup Tag">
              <template v-if="!attributionRows(store.attribution?.bySetupTag).length">
                <p class="py-6 text-center text-sm text-text-muted">
                  No tagged setups. Link executions in your journal to see setup attribution.
                </p>
              </template>
              <table v-else class="w-full text-sm">
                <thead>
                  <tr class="border-b border-border-hair text-left text-xs text-text-muted">
                    <th class="pb-2 font-medium">Setup Tag</th>
                    <th class="pb-2 text-right font-medium">Trades</th>
                    <th class="pb-2 text-right font-medium">Win%</th>
                    <th class="pb-2 text-right font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in attributionRows(store.attribution?.bySetupTag)"
                    :key="row.label"
                    class="border-b border-border-hair/50 last:border-0"
                  >
                    <td class="py-1.5 font-medium text-text-primary">{{ row.label }}</td>
                    <td class="py-1.5 text-right font-mono text-text-secondary">{{ row.trades }}</td>
                    <td class="py-1.5 text-right font-mono text-text-muted">
                      {{ row.winRate != null ? `${(row.winRate * 100).toFixed(0)}%` : '—' }}
                    </td>
                    <td class="py-1.5 text-right font-mono" :class="pnlClass(row.pnl)">{{ fmtPnl(row.pnl) }}</td>
                  </tr>
                </tbody>
              </table>
            </UiPanel>

            <!-- By Weekday -->
            <UiPanel title="By Weekday">
              <template v-if="!attributionRows(store.attribution?.byWeekday).length">
                <p class="py-6 text-center text-sm text-text-muted">No data</p>
              </template>
              <table v-else class="w-full text-sm">
                <thead>
                  <tr class="border-b border-border-hair text-left text-xs text-text-muted">
                    <th class="pb-2 font-medium">Day</th>
                    <th class="pb-2 text-right font-medium">Trades</th>
                    <th class="pb-2 text-right font-medium">Win%</th>
                    <th class="pb-2 text-right font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in attributionRows(store.attribution?.byWeekday)"
                    :key="row.label"
                    class="border-b border-border-hair/50 last:border-0"
                  >
                    <td class="py-1.5 font-medium text-text-primary">{{ row.label }}</td>
                    <td class="py-1.5 text-right font-mono text-text-secondary">{{ row.trades }}</td>
                    <td class="py-1.5 text-right font-mono text-text-muted">
                      {{ row.winRate != null ? `${(row.winRate * 100).toFixed(0)}%` : '—' }}
                    </td>
                    <td class="py-1.5 text-right font-mono" :class="pnlClass(row.pnl)">{{ fmtPnl(row.pnl) }}</td>
                  </tr>
                </tbody>
              </table>
            </UiPanel>

            <!-- By Session / Time of Day -->
            <UiPanel title="By Session (Approx. ET)">
              <template v-if="!attributionRows(store.attribution?.bySession).length">
                <p class="py-6 text-center text-sm text-text-muted">No data</p>
              </template>
              <table v-else class="w-full text-sm">
                <thead>
                  <tr class="border-b border-border-hair text-left text-xs text-text-muted">
                    <th class="pb-2 font-medium">Session</th>
                    <th class="pb-2 text-right font-medium">Trades</th>
                    <th class="pb-2 text-right font-medium">Win%</th>
                    <th class="pb-2 text-right font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in attributionRows(store.attribution?.bySession)"
                    :key="row.label"
                    class="border-b border-border-hair/50 last:border-0"
                  >
                    <td class="py-1.5 font-medium text-text-primary">{{ row.label }}</td>
                    <td class="py-1.5 text-right font-mono text-text-secondary">{{ row.trades }}</td>
                    <td class="py-1.5 text-right font-mono text-text-muted">
                      {{ row.winRate != null ? `${(row.winRate * 100).toFixed(0)}%` : '—' }}
                    </td>
                    <td class="py-1.5 text-right font-mono" :class="pnlClass(row.pnl)">{{ fmtPnl(row.pnl) }}</td>
                  </tr>
                </tbody>
              </table>
            </UiPanel>
          </div>

          <!-- Empty state for attribution -->
          <div
            v-if="!store.attribution?.bySymbol.length && !store.attribution?.bySetupTag.length"
            class="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-lg border border-border-hair bg-bg-surface text-center"
          >
            <p class="text-sm font-medium text-text-primary">No attribution data</p>
            <p class="max-w-sm text-sm text-text-secondary">
              Import execution data and link journal entries with setup tags to see attribution breakdowns.
            </p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
