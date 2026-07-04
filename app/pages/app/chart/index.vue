<script setup lang="ts">
definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

const workspace = useWorkspaceStore()
const intervals = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const

onMounted(async () => {
  await workspace.loadWatchlists()
  await workspace.ensureWorkspace()
})

function setIntervalValue(value: typeof intervals[number]) {
  workspace.chartInterval = value
  workspace.saveWorkspace()
}
</script>

<template>
  <div class="flex h-[calc(100dvh-var(--spacing-command-bar))] flex-col lg:flex-row">
    <WorkspaceWatchlistRail />

    <div class="flex min-w-0 flex-1 flex-col gap-4 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-text-primary">
            Chart Workspace
          </h1>
          <p class="mt-1 text-sm text-text-secondary">
            Historical candles with live updates over WebSocket.
          </p>
        </div>

        <div class="flex flex-wrap gap-1">
          <button
            v-for="value in intervals"
            :key="value"
            type="button"
            class="rounded-md border px-2.5 py-1 font-mono text-xs transition-colors"
            :class="
              workspace.chartInterval === value
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border-hair text-text-muted hover:bg-bg-raised hover:text-text-secondary'
            "
            @click="setIntervalValue(value)"
          >
            {{ value }}
          </button>
        </div>
      </div>

      <ClientOnly>
        <ChartChartPanel
          :symbol-id="workspace.activeSymbolId"
          :interval="workspace.chartInterval ?? '1h'"
        />
      </ClientOnly>
    </div>
  </div>
</template>
