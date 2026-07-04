<script setup lang="ts">
import type { BacktestProgress, BacktestStage } from '#shared/types/backtest'

const props = defineProps<{
  progress: BacktestProgress | null
  status?: string | null
  error?: string | null
}>()

type DisplayStage = 'loading_data' | 'simulating' | 'computing_metrics' | 'saving'

const STAGES: Array<{ key: DisplayStage, label: string }> = [
  { key: 'loading_data', label: 'Loading data' },
  { key: 'simulating', label: 'Simulating' },
  { key: 'computing_metrics', label: 'Computing metrics' },
  { key: 'saving', label: 'Saving results' },
]

const STAGE_MAP: Record<BacktestStage, DisplayStage> = {
  queued: 'loading_data',
  loading: 'loading_data',
  fetching_data: 'loading_data',
  simulating: 'simulating',
  metrics: 'computing_metrics',
  computing_metrics: 'computing_metrics',
  persisting: 'saving',
  saving: 'saving',
  done: 'saving',
  failed: 'saving',
}

const pct = computed(() => props.progress?.pct ?? 0)

const currentStage = computed<DisplayStage>(() => {
  const stage = props.progress?.stage
  if (!stage) return 'loading_data'
  return STAGE_MAP[stage] ?? 'loading_data'
})

const stageIndex = computed(() =>
  STAGES.findIndex((stage) => stage.key === currentStage.value),
)

function stageState(index: number) {
  if (index < stageIndex.value) return 'done'
  if (index === stageIndex.value) return 'active'
  return 'pending'
}
</script>

<template>
  <UiPanel
    title="Backtest in progress"
    class="max-w-2xl"
  >
    <div class="flex flex-col gap-6">
      <div>
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="text-text-secondary">
            {{ STAGES.find((s) => s.key === currentStage)?.label ?? 'Starting…' }}
          </span>
          <span class="font-mono text-xs tabular-nums text-text-muted">
            {{ Math.round(pct) }}%
          </span>
        </div>

        <div
          class="h-2 overflow-hidden rounded-full bg-bg-raised"
          role="progressbar"
          :aria-valuenow="Math.round(pct)"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            :style="{ width: `${pct}%` }"
          />
        </div>
      </div>

      <ol class="grid gap-2 sm:grid-cols-2">
        <li
          v-for="(stage, index) in STAGES"
          :key="stage.key"
          class="flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors"
          :class="{
            'border-accent/40 bg-accent/5 text-text-primary': stageState(index) === 'active',
            'border-border-hair bg-bg-raised/50 text-text-secondary': stageState(index) === 'done',
            'border-border-hair text-text-muted': stageState(index) === 'pending',
          }"
        >
          <span
            class="flex size-5 shrink-0 items-center justify-center rounded-full text-2xs font-medium"
            :class="{
              'bg-accent text-bg-base': stageState(index) === 'active',
              'bg-bull/20 text-bull': stageState(index) === 'done',
              'bg-bg-overlay text-text-muted': stageState(index) === 'pending',
            }"
          >
            <template v-if="stageState(index) === 'done'">✓</template>
            <template v-else>{{ index + 1 }}</template>
          </span>
          {{ stage.label }}
        </li>
      </ol>

      <p
        v-if="props.status"
        class="text-xs text-text-muted"
      >
        Status: <span class="font-mono text-text-secondary">{{ props.status }}</span>
      </p>

      <div
        v-if="props.error"
        class="rounded-md border border-bear/30 bg-bear/10 px-3 py-2 text-sm text-bear"
      >
        {{ props.error }}
      </div>
    </div>
  </UiPanel>
</template>
