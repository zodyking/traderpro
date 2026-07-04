<script setup lang="ts">
definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

const route = useRoute()
const backtestStore = useBacktestStore()

const runId = computed(() => {
  const value = route.query.run
  return typeof value === 'string' ? value : null
})

const showEmpty = computed(() => !runId.value && !backtestStore.activeRun)
const showProgress = computed(() => backtestStore.isRunning)
const showReport = computed(() => backtestStore.isComplete && backtestStore.metrics != null)
const showFailed = computed(() => backtestStore.activeRun?.status === 'failed')

function pct(value?: number | null, digits = 1) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

async function handleWalkForward() {
  const runId = backtestStore.activeRun?.id
  if (!runId) return
  await backtestStore.runWalkForward(runId)
}

async function handleMonteCarlo() {
  const runId = backtestStore.activeRun?.id
  if (!runId) return
  await backtestStore.runMonteCarlo(runId)
}

watch(
  runId,
  (id) => {
    if (id) {
      backtestStore.initializeRun(id)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  backtestStore.stopTracking()
})
</script>

<template>
  <div class="flex h-[calc(100dvh-var(--spacing-command-bar))] flex-col">
    <header class="shrink-0 border-b border-border-hair px-4 py-3">
      <h1 class="text-lg font-semibold text-text-primary">
        Backtest Report
      </h1>
      <p class="mt-0.5 text-sm text-text-secondary">
        Performance metrics, equity curve, and trade log.
      </p>
    </header>

    <div class="flex-1 overflow-y-auto p-4">
      <div
        v-if="showEmpty"
        class="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 text-center"
      >
        <div class="rounded-lg border border-border-hair bg-bg-surface p-8">
          <p class="text-sm font-medium text-text-primary">
            No backtest selected
          </p>
          <p class="mt-2 max-w-sm text-sm text-text-secondary">
            Build a strategy in Strategy Lab, save a version, and run a backtest to see results here.
          </p>
          <NuxtLink to="/app/strategy">
            <UiBtn class="mt-5">
              Open Strategy Lab
            </UiBtn>
          </NuxtLink>
        </div>
      </div>

      <div
        v-else-if="backtestStore.loading && !backtestStore.metrics"
        class="flex flex-col gap-4"
      >
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <UiSkeleton
            v-for="index in 8"
            :key="index"
            class="h-24 w-full"
          />
        </div>
        <UiSkeleton class="h-[300px] w-full" />
      </div>

      <div
        v-else-if="showProgress"
        class="flex flex-col items-center gap-4 pt-8"
      >
        <BacktestBacktestProgress
          :progress="backtestStore.progress"
          :status="backtestStore.activeRun?.status"
          :error="backtestStore.error"
        />
        <UiBtn
          variant="secondary"
          :disabled="backtestStore.loading"
          @click="backtestStore.cancelActiveBacktest()"
        >
          Cancel backtest
        </UiBtn>
      </div>

      <div
        v-else-if="showFailed"
        class="mx-auto max-w-lg pt-8 text-center"
      >
        <div class="rounded-lg border border-bear/30 bg-bear/10 p-6">
          <p class="text-sm font-medium text-bear">
            Backtest failed
          </p>
          <p class="mt-2 text-sm text-text-secondary">
            {{ backtestStore.error ?? backtestStore.activeRun?.error ?? 'An unknown error occurred.' }}
          </p>
          <NuxtLink to="/app/strategy">
            <UiBtn
              class="mt-4"
              variant="secondary"
            >
              Return to Strategy Lab
            </UiBtn>
          </NuxtLink>
        </div>
      </div>

      <BacktestBacktestReport
        v-else-if="showReport"
        :metrics="backtestStore.metrics"
        :trades="backtestStore.trades"
        :equity="backtestStore.equity"
        :loading="backtestStore.loading"
      />

      <div
        v-if="showReport && backtestStore.activeRun?.id"
        class="mt-6"
      >
        <UiPanel title="Advanced Research">
          <p class="mb-4 text-sm text-text-secondary">
            Validate robustness with walk-forward folds and Monte Carlo resampling of trade outcomes.
          </p>

          <div class="flex flex-wrap gap-3">
            <UiBtn
              variant="secondary"
              :disabled="backtestStore.researchLoading"
              @click="handleWalkForward"
            >
              Run Walk-Forward
            </UiBtn>
            <UiBtn
              variant="secondary"
              :disabled="backtestStore.researchLoading"
              @click="handleMonteCarlo"
            >
              Run Monte Carlo
            </UiBtn>
          </div>

          <div
            v-if="backtestStore.walkForwardResult"
            class="mt-5 rounded-lg border border-border-hair bg-bg-surface p-4"
          >
            <h3 class="text-sm font-medium text-text-primary">
              Walk-Forward ({{ backtestStore.walkForwardResult.foldCount }} folds)
            </h3>
            <p class="mt-1 text-sm text-text-secondary">
              Avg return {{ pct(backtestStore.walkForwardResult.aggregate.avgTotalReturn) }}
              · Avg max DD {{ pct(backtestStore.walkForwardResult.aggregate.avgMaxDrawdown) }}
              · Avg Sharpe {{ backtestStore.walkForwardResult.aggregate.avgSharpe?.toFixed(2) ?? '—' }}
            </p>
            <div class="mt-3 overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="text-text-secondary">
                    <th class="pb-2 pr-4 font-medium">
                      Fold
                    </th>
                    <th class="pb-2 pr-4 font-medium">
                      Period
                    </th>
                    <th class="pb-2 pr-4 font-medium">
                      Return
                    </th>
                    <th class="pb-2 font-medium">
                      Max DD
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="fold in backtestStore.walkForwardResult.folds"
                    :key="fold.foldIndex"
                    class="border-t border-border-hair text-text-primary"
                  >
                    <td class="py-2 pr-4">
                      {{ fold.foldIndex + 1 }}
                    </td>
                    <td class="py-2 pr-4 text-text-secondary">
                      {{ new Date(fold.dateRange.from).toLocaleDateString() }}
                      –
                      {{ new Date(fold.dateRange.to).toLocaleDateString() }}
                    </td>
                    <td class="py-2 pr-4">
                      {{ pct(fold.metrics.totalReturn) }}
                    </td>
                    <td class="py-2">
                      {{ pct(fold.metrics.maxDrawdown) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div
            v-if="backtestStore.monteCarloResult"
            class="mt-5 rounded-lg border border-border-hair bg-bg-surface p-4"
          >
            <h3 class="text-sm font-medium text-text-primary">
              Monte Carlo ({{ backtestStore.monteCarloResult.iterations }} iterations)
            </h3>
            <p class="mt-1 text-sm text-text-secondary">
              {{ backtestStore.monteCarloResult.tradeCount }} trades resampled with replacement.
            </p>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Total return
                </p>
                <p class="mt-1 text-sm text-text-primary">
                  P5 {{ pct(backtestStore.monteCarloResult.returns.p5) }}
                  · P50 {{ pct(backtestStore.monteCarloResult.returns.p50) }}
                  · P95 {{ pct(backtestStore.monteCarloResult.returns.p95) }}
                </p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Max drawdown
                </p>
                <p class="mt-1 text-sm text-text-primary">
                  P5 {{ pct(backtestStore.monteCarloResult.maxDrawdown.p5) }}
                  · P50 {{ pct(backtestStore.monteCarloResult.maxDrawdown.p50) }}
                  · P95 {{ pct(backtestStore.monteCarloResult.maxDrawdown.p95) }}
                </p>
              </div>
            </div>
          </div>
        </UiPanel>
      </div>

      <div
        v-if="showReport && backtestStore.activeRun?.strategyVersionId"
        class="mt-4"
      >
        <UiPanel title="AI Review">
          <AiAIReviewWidget
            target-type="strategy"
            :target-id="backtestStore.activeRun.strategyVersionId"
            label="Backtest Critique"
          />
        </UiPanel>
      </div>
    </div>
  </div>
</template>
