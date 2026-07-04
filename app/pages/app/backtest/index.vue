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
        class="flex justify-center pt-8"
      >
        <BacktestBacktestProgress
          :progress="backtestStore.progress"
          :status="backtestStore.activeRun?.status"
          :error="backtestStore.error"
        />
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
