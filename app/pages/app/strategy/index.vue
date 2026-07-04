<script setup lang="ts">
definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

const strategyStore = useStrategyStore()
const workspace = useWorkspaceStore()

const validationIssues = computed(() => strategyStore.validate())
const hasErrors = computed(() => validationIssues.value.some((issue) => issue.level === 'error'))
const signalMarkers = ref<Array<{ time: string, kind: 'entry_long' | 'entry_short' | 'exit' | 'filter' | 'warning', label?: string }>>([])
const triggerCount = ref(0)
let previewTimer: ReturnType<typeof setTimeout> | undefined

async function refreshPreview() {
  if (!workspace.activeSymbolId) {
    signalMarkers.value = []
    triggerCount.value = 0
    return
  }

  try {
    const data = await $fetch<{
      markers: Array<{ time: string, kind: string, signalName: string }>
      triggerCount: number
    }>('/api/strategies/preview', {
      method: 'POST',
      body: {
        symbolId: workspace.activeSymbolId,
        interval: workspace.chartInterval ?? '1h',
        rules: strategyStore.draftRules,
      },
    })

    signalMarkers.value = data.markers.map((marker) => ({
      time: marker.time,
      kind: marker.kind as 'entry_long' | 'entry_short' | 'exit' | 'filter' | 'warning',
      label: marker.signalName,
    }))
    triggerCount.value = data.triggerCount
  }
  catch {
    signalMarkers.value = []
    triggerCount.value = 0
  }
}

watch(
  () => [strategyStore.draftRules, workspace.activeSymbolId, workspace.chartInterval] as const,
  () => {
    clearTimeout(previewTimer)
    previewTimer = setTimeout(() => refreshPreview(), 400)
  },
  { deep: true, immediate: true },
)

onMounted(async () => {
  await Promise.all([
    strategyStore.loadStrategies(),
    workspace.ensureWorkspace(),
  ])
})

async function handleSave() {
  await strategyStore.saveVersion()
}

function handleSelectVersion(versionId: string) {
  if (strategyStore.isDirty && !confirm('Discard unsaved changes and switch version?')) {
    return
  }
  strategyStore.selectVersion(versionId)
}
</script>

<template>
  <div class="flex h-[calc(100dvh-var(--spacing-command-bar))] flex-col">
    <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-hair px-4 py-3">
      <div>
        <h1 class="text-lg font-semibold text-text-primary">
          Strategy Lab
        </h1>
        <p class="mt-0.5 text-sm text-text-secondary">
          Build, version, and validate rule-based strategies.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UiBadge
          v-if="triggerCount > 0"
          :label="`${triggerCount} triggers`"
          variant="info"
        />
        <UiBadge
          v-if="strategyStore.isDirty"
          label="Unsaved"
          variant="warn"
        />
        <UiBtn
          variant="secondary"
          size="sm"
          :loading="strategyStore.saving"
          :disabled="strategyStore.loading || hasErrors"
          @click="handleSave"
        >
          Save version
        </UiBtn>
      </div>
    </header>

    <div
      v-if="strategyStore.error"
      class="mx-4 mt-3 rounded-md border border-bear/30 bg-bear/10 px-3 py-2 text-sm text-bear"
    >
      {{ strategyStore.error }}
    </div>

    <div
      v-if="validationIssues.length"
      class="mx-4 mt-3 flex flex-wrap gap-2"
    >
      <UiBadge
        v-for="issue in validationIssues"
        :key="`${issue.signalId}-${issue.level}`"
        :label="`${issue.signalName}: ${issue.message}`"
        :variant="issue.level === 'error' ? 'bear' : 'warn'"
      />
    </div>

    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div class="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <UiPanel :title="strategyStore.draftName">
          <template #actions>
            <span class="text-2xs tracking-wide text-text-muted uppercase">
              Rule canvas
            </span>
          </template>

          <div
            v-if="strategyStore.loading"
            class="flex flex-col gap-3"
          >
            <UiSkeleton class="h-24 w-full" />
            <UiSkeleton class="h-24 w-full" />
            <UiSkeleton class="h-24 w-full" />
          </div>

          <div
            v-else
            class="flex flex-col gap-4"
          >
            <StrategyRuleGroup
              v-for="(signal, index) in strategyStore.draftRules.signals"
              :key="signal.id"
              :signal="signal"
              @update:signal="strategyStore.updateSignal(index, $event)"
            />
          </div>
        </UiPanel>

        <StrategyRiskModelForm v-model="strategyStore.draftRiskModel" />
      </div>

      <aside class="flex w-full shrink-0 flex-col border-t border-border-hair lg:w-[min(42rem,45%)] lg:border-t-0 lg:border-l">
        <div class="flex-1 overflow-y-auto p-4">
          <ClientOnly>
            <ChartChartPanel
              v-if="workspace.activeSymbolId"
              :symbol-id="workspace.activeSymbolId"
              :interval="workspace.chartInterval ?? '1h'"
              :height="360"
              :markers="signalMarkers"
            />
            <UiPanel
              v-else
              title="Chart preview"
            >
              <div class="flex h-[360px] flex-col items-center justify-center gap-2 text-center">
                <p class="text-sm text-text-secondary">
                  No symbol selected
                </p>
                <p class="max-w-xs text-xs text-text-muted">
                  Select a symbol from the Chart workspace to preview price action alongside your rules.
                </p>
              </div>
            </UiPanel>
          </ClientOnly>
        </div>
      </aside>
    </div>

    <footer class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border-hair bg-bg-surface px-4 py-3">
      <div class="min-w-0 flex-1">
        <p class="mb-1.5 text-2xs font-medium tracking-wide text-text-muted uppercase">
          Versions
        </p>
        <StrategyVersionTimeline
          :versions="strategyStore.versions"
          :active-version-id="strategyStore.activeVersionId"
          @select="handleSelectVersion"
        />
      </div>

      <UiBtn
        disabled
        title="Backtest runner coming in task 19"
      >
        Run backtest
      </UiBtn>
    </footer>
  </div>
</template>
