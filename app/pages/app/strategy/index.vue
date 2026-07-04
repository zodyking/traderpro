<script setup lang="ts">
definePageMeta({
  layout: 'app',
  middleware: 'auth',
})

const strategyStore = useStrategyStore()
const workspace = useWorkspaceStore()
const backtestStore = useBacktestStore()

const templatePickerOpen = ref(false)

function applyTemplate(templateId: string) {
  if (strategyStore.isDirty && !confirm('Discard unsaved changes and load template?')) return
  strategyStore.resetDraftFromTemplate(templateId as Parameters<typeof strategyStore.resetDraftFromTemplate>[0])
  templatePickerOpen.value = false
}

// Novice guardrail
const showNoviceDialog = ref(false)
const pendingSaveNote = ref<string | undefined>()
const { user } = useUserSession()
const isNovice = computed(() => (user.value as { experience?: string } | null)?.experience === 'novice')

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
  // Section 21.1: if novice user has no stop-loss, show blocking dialog
  const hasStopLoss = Boolean(strategyStore.draftRiskModel.stopLoss)
  if (isNovice.value && !hasStopLoss) {
    showNoviceDialog.value = true
    return
  }
  await strategyStore.saveVersion()
}

async function confirmSaveAnyway() {
  showNoviceDialog.value = false
  await strategyStore.saveVersion(pendingSaveNote.value)
  pendingSaveNote.value = undefined
}

function handleSelectVersion(versionId: string) {
  if (strategyStore.isDirty && !confirm('Discard unsaved changes and switch version?')) {
    return
  }
  strategyStore.selectVersion(versionId)
}

const canRunBacktest = computed(() =>
  Boolean(
    strategyStore.currentStrategy
    && strategyStore.activeVersionId
    && !strategyStore.isDirty
    && workspace.activeSymbolId
    && !hasErrors.value,
  ),
)

async function handleRunBacktest() {
  const versionId = strategyStore.activeVersionId
  const symbolId = workspace.activeSymbolId
  if (!versionId || !symbolId) return

  const run = await backtestStore.submitBacktest(
    versionId,
    symbolId,
    (workspace.chartInterval ?? '1h') as '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w',
  )
  await navigateTo(`/app/backtest?run=${run.id}`)
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
        <div class="relative">
          <UiBtn
            variant="ghost"
            size="sm"
            @click="templatePickerOpen = !templatePickerOpen"
          >
            Templates
            <svg class="size-3.5 ml-0.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </UiBtn>
          <div
            v-if="templatePickerOpen"
            class="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border-hair bg-bg-surface shadow-panel"
          >
            <div class="border-b border-border-hair px-3 py-2">
              <p class="text-2xs font-medium tracking-wide text-text-muted uppercase">
                Starter Templates
              </p>
            </div>
            <div class="flex flex-col py-1">
              <button
                v-for="tpl in strategyStore.templates"
                :key="tpl.id"
                class="flex flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-bg-raised transition-colors"
                @click="applyTemplate(tpl.id)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-medium text-text-primary">{{ tpl.name }}</span>
                  <span
                    class="text-2xs px-1.5 py-0.5 rounded font-medium"
                    :class="{
                      'bg-bull/10 text-bull': tpl.difficulty === 'beginner',
                      'bg-accent/10 text-accent': tpl.difficulty === 'intermediate',
                      'bg-warn/10 text-warn': tpl.difficulty === 'advanced',
                    }"
                  >
                    {{ tpl.difficulty }}
                  </span>
                </div>
                <p class="text-xs text-text-muted leading-snug">{{ tpl.description }}</p>
              </button>
            </div>
          </div>
          <div
            v-if="templatePickerOpen"
            class="fixed inset-0 z-40"
            @click="templatePickerOpen = false"
          />
        </div>
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
        <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
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

          <UiPanel
            v-if="strategyStore.activeVersionId && !strategyStore.isDirty"
            title="AI Review"
          >
            <AiAIReviewWidget
              target-type="strategy"
              :target-id="strategyStore.activeVersionId"
              label="Strategy Critique"
            />
          </UiPanel>
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
        :disabled="!canRunBacktest"
        :loading="backtestStore.submitting"
        :title="!workspace.activeSymbolId ? 'Select a symbol in Chart workspace' : !canRunBacktest ? 'Save strategy version first' : undefined"
        @click="handleRunBacktest"
      >
        Run backtest
      </UiBtn>
    </footer>

    <!-- Novice guardrail: blocking dialog when no stop-loss is set -->
    <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showNoviceDialog"
        class="fixed inset-0 z-50 flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="novice-dialog-title"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showNoviceDialog = false" />
        <div class="relative z-10 w-full max-w-md rounded-xl border border-warn/40 bg-bg-overlay p-6 shadow-2xl">
          <div class="mb-4 flex items-start gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-warn/20">
              <svg class="size-5 text-warn" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
              </svg>
            </span>
            <div>
              <h2 id="novice-dialog-title" class="font-semibold text-text-primary">
                No stop-loss configured
              </h2>
              <p class="mt-1 text-sm text-text-secondary">
                Trading without a stop-loss is the most common cause of large, unplanned losses for new traders.
                We recommend setting a stop-loss before saving this strategy.
              </p>
            </div>
          </div>

          <div class="rounded-lg border border-border-hair bg-bg-raised p-3 text-xs text-text-secondary">
            <span class="font-medium text-text-primary">How to add one:</span>
            scroll down to the Risk Model section and set a stop-loss type (fixed, percent, or ATR).
          </div>

          <div class="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <UiBtn
              variant="secondary"
              @click="showNoviceDialog = false"
            >
              Go back and add a stop-loss
            </UiBtn>
            <UiBtn
              variant="ghost"
              class="text-text-muted text-sm"
              @click="confirmSaveAnyway"
            >
              Save anyway (I understand the risk)
            </UiBtn>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</div>
</template>
